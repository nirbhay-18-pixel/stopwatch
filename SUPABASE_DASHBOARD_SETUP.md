# Supabase Dashboard Setup Guide

## ✅ Current Status

Your Tempo app is ready for Supabase integration. The connection test component has been added to Settings.

**What's already done:**
- ✅ Supabase client initialization code
- ✅ Environment variable reading (VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY)
- ✅ No service_role key exposed
- ✅ .env.example created
- ✅ .gitignore updated
- ✅ Connection test component added
- ✅ App works in local-only mode without Supabase

## 📋 Manual Steps in Supabase Dashboard

### Step 1: Create Supabase Project

1. Go to [https://supabase.com](https://supabase.com)
2. Click **"Start your project"** or **"New Project"**
3. Fill in the form:
   - **Organization**: Select your organization (or create one)
   - **Project name**: `tempo-tracker` (or any name you prefer)
   - **Database Password**: Choose a strong password (you won't need this later, but save it anyway)
   - **Region**: Choose the region closest to you
   - **Pricing Plan**: Free (sufficient for personal use)
4. Click **"Create new project"**
5. Wait for the project to be provisioned (takes ~2 minutes)

### Step 2: Get API Credentials

1. In your Supabase dashboard, go to **Project Settings** (gear icon in left sidebar)
2. Click **"API"** in the left menu
3. You'll see two important values:

   **Project URL:**
   ```
   https://xxxxxxxxxxxx.supabase.co
   ```
   Copy this value.

   **Project API keys → anon public:**
   ```
   eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
   ```
   Copy this value (it's a long string).

   ⚠️ **IMPORTANT**: Only copy the `anon` key. Never use the `service_role` key in the frontend!

### Step 3: Create .env File

1. In your project root directory, create a file named `.env` (no extension)
2. Add these two lines:

```bash
VITE_SUPABASE_URL=https://xxxxxxxxxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

3. Replace the values with your actual Project URL and anon key
4. Save the file

**Example:**
```bash
VITE_SUPABASE_URL=https://abcdefghijk.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFiY2RlZmdoaWprIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MDAwMDAwMDAsImV4cCI6MjAwMDAwMDAwMH0.SIGNATURE_HERE
```

### Step 4: Restart Development Server

After creating the `.env` file, you need to restart your development server:

```bash
# Stop the server (Ctrl+C)
# Then restart it
npm run dev
```

This is necessary because Vite only reads environment variables at startup.

### Step 5: Verify Connection

1. Open your app in the browser
2. Go to **Settings** (click the gear icon)
3. Look for the **"Cloud Sync"** section
4. You should see:
   - ✅ Green checkmark
   - "Supabase Connected"
   - "Successfully connected to Supabase. Ready for authentication."

If you see an error instead, check:
- The `.env` file exists in the project root
- The values are correct (no extra spaces or quotes)
- You restarted the dev server after creating `.env`

### Step 6: Configure Email Authentication

1. In Supabase dashboard, go to **Authentication** (lock icon in left sidebar)
2. Click **"Providers"** in the left menu
3. Find **"Email"** in the list
4. Make sure **"Enable Email provider"** is turned ON
5. Optional: Disable **"Confirm email"** for easier testing
   - This allows users to register without email verification
   - For production, you should enable email confirmation
6. Click **"Save"**

### Step 7: Test Authentication (Optional)

You can test if authentication works:

1. In Supabase dashboard, go to **Authentication** → **Users**
2. Click **"Add user"** → **"Create new user"**
3. Enter an email and password
4. Click **"Create user"**
5. The user should appear in the list

This verifies that authentication is working before we implement the login UI.

## 🔒 Security Checklist

Before proceeding to database migration, verify:

- [ ] `.env` file exists in project root
- [ ] `.env` contains only `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`
- [ ] `.env` is NOT committed to git (check `.gitignore`)
- [ ] No `service_role` key in `.env` or anywhere in the code
- [ ] Connection test shows green checkmark in Settings
- [ ] Email authentication is enabled in Supabase dashboard

## 📊 What Happens Next

After you complete these steps:

1. **Connection verified**: The app can communicate with Supabase
2. **Ready for database**: We can create the tables and RLS policies
3. **Ready for auth UI**: We can implement login/register screens
4. **Ready for sync**: We can implement data synchronization

## 🛑 STOP HERE

**Do not proceed to database migration yet.**

Wait for confirmation that:
- ✅ The connection test shows green
- ✅ You can see "Supabase Connected" in Settings
- ✅ No errors in the browser console

Once confirmed, I'll provide the database migration SQL and next steps.

## 🆘 Troubleshooting

### "Cloud Sync Not Configured" message

**Problem**: Settings shows "Cloud Sync Not Configured"

**Solution**:
1. Check that `.env` file exists in project root
2. Check that it contains both `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`
3. Restart the dev server (`npm run dev`)
4. Hard refresh the browser (Ctrl+Shift+R or Cmd+Shift+R)

### "Connection Error" message

**Problem**: Settings shows "Connection Error" with an error message

**Common errors**:

**"Invalid API key"**
- Check that you copied the `anon` key, not the `service_role` key
- Make sure there are no extra spaces or quotes in the `.env` file

**"Failed to fetch"**
- Check that the Project URL is correct
- Make sure your Supabase project is active (not paused)

**"JWT expired"**
- This shouldn't happen with the anon key
- Try regenerating the API key in Supabase dashboard

### Environment variables not loading

**Problem**: App still shows "Not Configured" after creating `.env`

**Solution**:
1. Stop the dev server (Ctrl+C)
2. Delete the `.vite` cache folder if it exists
3. Restart the dev server
4. Hard refresh the browser

### Still not working?

1. Open browser DevTools (F12)
2. Go to Console tab
3. Look for errors related to Supabase
4. Check Network tab for failed requests
5. Share the error message for help

## 📝 Summary

**What you need to do:**
1. Create Supabase project
2. Copy Project URL and anon key
3. Create `.env` file with credentials
4. Restart dev server
5. Verify connection in Settings
6. Enable Email authentication

**What I'll do next:**
1. Provide database migration SQL
2. Implement login/register UI
3. Implement data synchronization
4. Test the complete flow

**Ready when you are!** Just confirm that the connection test shows green, and we'll proceed to the database migration.
