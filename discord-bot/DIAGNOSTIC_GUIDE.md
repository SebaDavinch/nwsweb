# Discord Bot Diagnostic Guide

## Latest Update (v0.3 - Diagnostic Logging)

Comprehensive logging has been added throughout the bot startup and interaction handling. Use this guide to interpret the logs and identify where the bot is failing.

---

## Startup Sequence - What You Should See

### Stage 1: Environment Loading
```
=== DISCORD BOT STARTUP DIAGNOSTICS ===
[ENV] Checking environment variables...
[ENV] DISCORD_BOT_TOKEN: ✓ SET (MzY4NTM2MDAwNTQyODc3MTUz...)
[ENV] DISCORD_CLIENT_ID: ✓ SET (1456647070223175945)
[ENV] DISCORD_GUILD_ID: ⚠ NOT SET (will register globally)
[ENV] VAMSYS_CLIENT_ID: ✓ SET
[ENV] VAMSYS_CLIENT_SECRET: ✓ SET
[ENV] Environment loading completed
```

**What to look for:**
- If `DISCORD_BOT_TOKEN: ✗ MISSING` → Bot cannot authenticate. Check `.env` file on hosting
- If `DISCORD_CLIENT_ID: ✗ MISSING` → Commands cannot register. Check `.env` file on hosting
- If `DISCORD_GUILD_ID: ⚠ NOT SET` → This is OK but commands take 1+ hour to appear. Set it in `.env` for instant registration

### Stage 2: Bootstrap (Login)
```
[BOOTSTRAP] Starting bot login...
[BOOTSTRAP] ✓ Client logged in, waiting for ready event...
```

**What to look for:**
- If you see "Starting bot login..." followed by nothing → Client.login() is hanging or failing
- If you see "Client logged in..." → Gateway connection is working

### Stage 3: Client Ready
```
[READY] ✓ Bot is online: NordwindDiscordBot#7425
[READY] User ID: 1456647070223175945
[READY] Guilds: 1
[READY] Bot is ready to receive interactions...
```

**What to look for:**
- This MUST appear for bot to work
- "Guilds: 1" means bot is in at least 1 guild
- If this doesn't appear within 10 seconds of startup → Bot crashed or never logged in

### Stage 4: Command Registration
```
[REGISTER] Starting command registration...
[REGISTER] Token available: Yes
[REGISTER] ClientId available: Yes (1456647070223175945)
[REGISTER] Commands to register: 23
[REGISTER] Registering 23 commands for guild: 1456647070223175945
[REGISTER] ✓ Slash commands registered for guild 1456647070223175945
```

**What to look for:**
- "Commands to register: 23" → Correct number of commands loaded
- "✓ Slash commands registered..." → Commands sent to Discord successfully
- If registration fails, you'll see: `[REGISTER] Slash command registration failed (attempt 1/6, status ...): ...`

---

## Runtime Interaction Logging

### When a User Triggers a Command

```
[INTERACTION] UserName#1234 triggered: /profile
[SLASH-COMMAND] /profile from UserName#1234 in guild 1456647070223175945
(... command processing ...)
```

**What to look for:**
- If you see `[INTERACTION]` but NOT `[SLASH-COMMAND]` → Interaction received but failed type check
- If you see both → Interaction is being processed correctly
- If you see neither → Bot is not receiving interactions from Discord at all

### When a Command Completes Successfully
The command will process and send a response (no error logs).

### When a Command Fails
```
[INTERACTION-ERROR] Handler failed (type: 1, command: profile, user: UserName#1234):
Error: Pilot profile not found. Link your Discord account in vAMSYS first.
[INTERACTION-ERROR] Failed to send error response: ...
```

**What to look for:**
- This shows exactly what went wrong and which command
- The user should receive an error message in Discord

---

## Debugging Scenarios

### Scenario 1: "Bot is running but doesn't respond to ANY commands"

**Check for this log sequence:**
```
[ENV] DISCORD_BOT_TOKEN: ✓ SET (...)
[BOOTSTRAP] Starting bot login...
[BOOTSTRAP] ✓ Client logged in, waiting for ready event...
[READY] ✓ Bot is online: ...
[REGISTER] ✓ Slash commands registered...
```

If you see all of these BUT commands still don't work:

1. **Check the logs after you try `/profile` in Discord:**
   - Do you see `[INTERACTION] UserName#... triggered: /profile`?
   - If NO → Bot not receiving interactions (network/gateway issue)
   - If YES → Go to Scenario 2

2. **Check bot is in the guild:**
   - In Discord, verify the bot appears in the member list
   - If NO → Re-invite bot with scopes: `bot`, `applications.commands`

3. **Check slash commands are registered:**
   - Discord Dev Portal → Your App → Slash Commands
   - Should show all commands (ping, profile, booking, etc.)
   - If empty → Check registration logs for errors

### Scenario 2: "/profile command starts processing but gets no response"

**Look for logs like:**
```
[SLASH-COMMAND] /profile from UserName#1234 in guild ...
```

But then no more logs related to that command.

**Possible causes:**
1. Command handler waiting for vAMSYS API → check network access to vamsys.io
2. Python script (profile_card.py) execution → check Python is installed on hosting
3. File I/O error → check disk space and permissions

### Scenario 3: "Bot crashes or stops responding"

**Look for:**
```
[INTERACTION-ERROR] Handler failed ...
```

Followed by bot going silent. Check:
1. Is error being logged? Copy the full error message
2. Is bot still running? Check hosting process list
3. Are there repeated errors? → May indicate infinite loop or memory leak

---

## How to Collect and Share Logs

### On Hosting (Linux/Ubuntu):
```bash
# If using systemd service:
journalctl -u discord-bot -n 100 --no-pager

# If running in Docker:
docker logs container_name

# If running in screen/tmux:
# Scroll up in the terminal session
```

### On Hosting (PM2 if installed):
```bash
pm2 logs discord-bot --lines 200
```

### On Windows (if applicable):
```powershell
# Check event viewer or last console output
# Or use: Get-EventLog -LogName Application | grep "discord-bot"
```

---

## Quick Checklist

When bot isn't responding:

- [ ] See `[ENV] DISCORD_BOT_TOKEN: ✓` (check .env file)
- [ ] See `[ENV] DISCORD_CLIENT_ID: ✓` (check .env file)
- [ ] See `[BOOTSTRAP] ✓ Client logged in...` (check network/token)
- [ ] See `[READY] ✓ Bot is online:` (check intents/cache)
- [ ] See `[REGISTER] ✓ Slash commands registered...` (check registration)
- [ ] See `[INTERACTION]` when you trigger command (check gateway)
- [ ] See `[SLASH-COMMAND] /...` when you trigger slash cmd (check type check)

If ANY of these is missing → that's where the problem is.

---

## Version History

- **v0.1**: Initial bot with basic commands
- **v0.2**: Fixed pilot count in presence, added command registration retries
- **v0.3**: Added comprehensive diagnostic logging (THIS VERSION)

