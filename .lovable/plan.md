
## Fix Build Error and Publish

### Problem
`src/pages/OptIns.tsx` line 68 uses `collaborator.level` but the `Collaborator` type has the level nested under `collaborator.role.level`.

### Fix
**File: `src/pages/OptIns.tsx`** — Change `collaborator.level < 5` to `collaborator.role.level < 5` on line 68.

### Then
Publish the project to make it live.
