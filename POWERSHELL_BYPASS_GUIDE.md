# PowerShell Execution Policy & npm Start Guide

## Why PowerShell Blocked npm Start

PowerShell has a **security feature called Execution Policy** that prevents scripts from running without authorization. This is a Windows safety mechanism.

### What Happened
```
npm : File C:\Program Files\nodejs\npm.ps1 cannot be loaded because running scripts 
is disabled on this system.
```

**Why?**
- npm is actually a PowerShell script file (`npm.ps1`)
- Your system's execution policy was set to `Restricted` or `AllUsers` policy
- PowerShell blocked it to prevent malicious scripts from running automatically

### Execution Policy Levels (from most to least restrictive)
1. **Restricted** (default) - No scripts can run
2. **AllSigned** - Only scripts signed by trusted publishers can run
3. **RemoteSigned** - Downloaded scripts must be signed; local scripts can run
4. **Unrestricted** - All scripts run without restriction
5. **Bypass** - All scripts run, no warnings

---

## Solutions to Bypass PowerShell Blocking

### Method 1: Bypass for Current Session Only (Temporary)
```powershell
Set-ExecutionPolicy -ExecutionPolicy Bypass -Scope Process
npm start
```
**Pros:** Safe, doesn't affect system permanently  
**Cons:** Only works for current PowerShell window

### Method 2: Use cmd.exe (Permanent Workaround)
```powershell
cmd.exe /c npm start
```
**Pros:** Bypasses PowerShell entirely, no policy changes  
**Cons:** Uses older Command Prompt interpreter

### Method 3: Change System Execution Policy (Permanent)
```powershell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
npm start
```
**Pros:** Works for all future PowerShell sessions  
**Cons:** Affects system-wide security policy

### Method 4: Run PowerShell as Administrator
Right-click PowerShell → "Run as Administrator" → then run npm start

---

## What I Did (The Solution Used)

```powershell
# Step 1: Bypass policy for current session
Set-ExecutionPolicy -ExecutionPolicy Bypass -Scope Process

# Step 2: Run npm through cmd.exe to ensure it works
cmd.exe /c npm start
```

**Why this worked:**
- `Set-ExecutionPolicy -Scope Process` = temporary bypass (only for current terminal)
- `cmd.exe /c` = explicitly use Command Prompt, which doesn't have the same restrictions
- This is the **safest approach** for development

---

## Understanding: "server node.js" vs "npm start"

### What You Tried
```powershell
server node.js
```
**Error:** `'server' is not recognized as a cmdlet`

**Why it failed:**
- PowerShell doesn't know what `server` is
- You were trying to run a file named `server` with argument `node.js`
- There's no executable file called `server` in your PATH

### What You Should Do Instead
```powershell
node server.js
```
or
```powershell
npm start
```

**Difference:**
- `node server.js` - Directly runs your Node.js server file
- `npm start` - Runs the script defined in `package.json` under `"scripts": { "start": "node server.js" }`

---

## localhost:3000 vs Live Server

### localhost:3000 (Development)
```
http://localhost:3000
```

**What is it?**
- `localhost` = your own computer (127.0.0.1)
- `3000` = the port (think of it as a "door" on your computer)
- Only accessible from YOUR machine
- Data is stored locally on your hard drive

**How it works:**
1. You run `npm start`
2. Node.js starts listening on port 3000
3. You open browser and type `http://localhost:3000`
4. Browser connects to your local server
5. No internet involved

**Pros:**
- Fast (no network latency)
- Safe for testing (not public)
- Easy to debug
- Free

**Cons:**
- Only you can access it
- Stops when you close terminal
- No real users can see it

### Live Server (Production)
```
https://www.yourdomain.com
or
https://123.456.789.101:3000
```

**What is it?**
- Runs on a computer somewhere in a data center
- Accessible from anywhere on the internet
- Data stored on cloud/remote server
- 24/7 uptime (unless server goes down)

**How it works:**
1. You deploy code to a hosting provider (AWS, Heroku, DigitalOcean, etc.)
2. The server runs your Node.js app
3. Domain name or IP points to that server
4. Anyone in the world can access it via URL
5. Internet is required

**Pros:**
- Publicly accessible
- Always running
- Real users can access it
- Professional appearance

**Cons:**
- Costs money
- Slower (network distance)
- Harder to debug
- Security concerns if not configured properly

---

## Quick Comparison Table

| Feature | localhost:3000 | Live Server |
|---------|-----------------|-------------|
| **Access** | Only your machine | Anywhere in world |
| **URL** | http://localhost:3000 | https://yourdomain.com |
| **Cost** | Free | $5-100+/month |
| **Running** | While terminal is open | 24/7 automatic |
| **Speed** | Instant (no network) | Depends on internet |
| **Database** | Local files/local DB | Cloud database |
| **Use Case** | Testing, development | Production, users |
| **Security** | Not important | Critical |

---

## Step-by-Step: Running Your Server

### On Your Local Machine (Development)
```powershell
# Open PowerShell/Terminal
cd c:\Users\SAMUEL WALE\Desktop\The_highly_elected

# Option 1: Use cmd.exe (safest)
cmd.exe /c npm start

# Option 2: Bypass PowerShell policy then run
Set-ExecutionPolicy -ExecutionPolicy Bypass -Scope Process
npm start
```

### Then Open Browser
1. Go to `http://localhost:3000`
2. You should see your HEBG Ministry website
3. Test member login, upload sermons, etc.

### When Ready for Live Server
1. Get hosting (Heroku, Railway, AWS, etc.)
2. Deploy code to hosting provider
3. Set up domain name (optional)
4. Server runs 24/7
5. Share the live URL with others

---

## Summary

**PowerShell blocked npm because:** Execution policies restrict script execution for security  
**How to fix it:** Use `cmd.exe /c npm start` or `Set-ExecutionPolicy -Scope Process`  
**localhost:3000:** Your personal computer running the server (development only)  
**Live server:** Remote computer accessible 24/7 from anywhere (production, real users)

