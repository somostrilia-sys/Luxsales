--[[
  Walk Agente Central Hub - AI Call Handler (Lua)

  Ativado quando uma chamada deve ser atendida por IA.
  Mantém a sessão ativa enquanto o AI Pipeline processa via WebSocket.
]]

local uuid = session:getVariable("uuid")
local company_id = session:getVariable("company_id")
local script_id = session:getVariable("script_id")
local ai_pipeline_ws = os.getenv("AI_PIPELINE_WS") or "ws://127.0.0.1:3001"

freeswitch.consoleLog("INFO", string.format("[AI Call] Starting AI for %s (script: %s)\n", uuid, script_id or "default"))

-- Ativar mod_audio_fork para streaming de áudio
local ws_url = string.format("%s/call/%s?company_id=%s&script_id=%s", ai_pipeline_ws, uuid, company_id, script_id or "")

local api = freeswitch.API()
local result = api:executeString(string.format("uuid_audio_fork %s start %s mono 8000", uuid, ws_url))
freeswitch.consoleLog("INFO", "[AI Call] Audio fork result: " .. (result or "nil") .. "\n")

-- Manter sessão ativa enquanto a IA está falando
-- A chamada termina quando: cliente desliga, IA desliga (via ESL), ou timeout
local max_duration = 600 -- 10 minutos máximo

session:execute("set", "api_hangup_hook=lua walk_ai_cleanup.lua")

-- Park a chamada (mantém ativa, áudio via WebSocket)
session:execute("park")

freeswitch.consoleLog("INFO", "[AI Call] Session ended for " .. uuid .. "\n")
