--[[
  Walk Agente Central Hub - IVR Handler (Lua)

  Executado pelo FreeSWITCH quando uma chamada inbound é recebida.
  Consulta Supabase para obter o menu IVR da empresa e processa DTMF.
]]

local curl = require("curl")
local json = require("cjson")

-- Variáveis da sessão
local session = freeswitch.Session()
local uuid = session:getVariable("uuid")
local caller = session:getVariable("caller_id_number")
local destination = session:getVariable("destination_number")
local company_id = session:getVariable("company_id")
local supabase_url = session:getVariable("supabase_url")

freeswitch.consoleLog("INFO", string.format("[IVR] Call %s from %s to %s\n", uuid, caller, destination))

-- Função para buscar IVR menu do Supabase
function getIVRMenu(menu_id)
    local url = supabase_url .. "/rest/v1/ivr_menus?select=*"
    if menu_id then
        url = url .. "&id=eq." .. menu_id
    else
        url = url .. "&company_id=eq." .. company_id .. "&is_active=eq.true&parent_menu_id=is.null"
    end

    local response_body = {}
    local _, code = http.request{
        url = url,
        headers = {
            ["apikey"] = os.getenv("SUPABASE_SERVICE_KEY"),
            ["Authorization"] = "Bearer " .. os.getenv("SUPABASE_SERVICE_KEY"),
        },
        sink = ltn12.sink.table(response_body),
    }

    if code == 200 then
        local data = json.decode(table.concat(response_body))
        return data[1]
    end
    return nil
end

-- Função para tocar áudio (URL ou TTS)
function playGreeting(menu)
    if menu.greeting_audio_url then
        -- Tocar arquivo de áudio
        session:streamFile(menu.greeting_audio_url)
    elseif menu.greeting_tts_text then
        -- TTS via mod_tts (ou Cartesia)
        session:speak(menu.greeting_tts_text)
    else
        session:streamFile("ivr/ivr-welcome.wav")
    end
end

-- Função principal do IVR
function processIVR(menu_id)
    local menu = getIVRMenu(menu_id)
    if not menu then
        freeswitch.consoleLog("ERR", "[IVR] Menu not found for company " .. company_id .. "\n")
        session:hangup("NORMAL_TEMPORARY_FAILURE")
        return
    end

    local timeout = menu.timeout_seconds or 10
    local max_retries = menu.max_retries or 3
    local options = menu.options or {}

    for attempt = 1, max_retries do
        -- Tocar saudação
        playGreeting(menu)

        -- Aguardar DTMF
        local digit = session:getDigits(1, "", timeout * 1000)

        if digit and digit ~= "" then
            freeswitch.consoleLog("INFO", string.format("[IVR] Digit: %s (call %s)\n", digit, uuid))

            -- Buscar opção correspondente
            local matched = false
            for _, opt in ipairs(options) do
                if opt.digit == digit then
                    matched = true
                    processAction(opt.action_type, opt.action_target, menu)
                    return
                end
            end

            if not matched then
                session:streamFile("ivr/ivr-that_was_an_invalid_entry.wav")
            end
        else
            -- Timeout
            if attempt < max_retries then
                session:streamFile("ivr/ivr-that_was_an_invalid_entry.wav")
            end
        end
    end

    -- Max retries atingido
    freeswitch.consoleLog("INFO", "[IVR] Max retries reached for " .. uuid .. "\n")
    session:hangup("NORMAL_CLEARING")
end

-- Processar ação do menu
function processAction(action_type, action_target, menu)
    freeswitch.consoleLog("INFO", string.format("[IVR] Action: %s → %s\n", action_type, action_target))

    if action_type == "transfer" then
        -- Transferir para ramal
        session:transfer(action_target, "XML", "default")

    elseif action_type == "submenu" then
        -- Ir para submenu
        processIVR(action_target)

    elseif action_type == "queue" then
        -- Entrar na fila (mod_callcenter)
        session:execute("callcenter", action_target)

    elseif action_type == "voicemail" then
        -- Ir para correio de voz
        session:execute("voicemail", "default " .. session:getVariable("domain") .. " " .. action_target)

    elseif action_type == "external" then
        -- Ligar para número externo
        session:execute("bridge", "sofia/gateway/walk-sip-trunk/" .. action_target)

    elseif action_type == "ai" then
        -- Ativar agente IA
        session:setVariable("ai_mode", "true")
        session:setVariable("script_id", action_target)
        -- O ESL Controller vai detectar e ativar mod_audio_fork
        session:execute("lua", "walk_ai_call.lua")
    end
end

-- Iniciar IVR
processIVR(nil)
