# Tempo - Supabase Sync Setup Guide

This guide explains how to set up cloud synchronization for Tempo using Supabase.

## Overview

Tempo now supports secure cloud synchronization across devices using Supabase. Your data is encrypted and synced in real-time, allowing you to access your time tracking data from any device.

## Features

- ✅ **Secure Authentication**: Email/password login with persistent sessions
- ✅ **Row Level Security**: Each user can only access their own data
- ✅ **Real-time Sync**: Changes sync automatically across devices
- ✅ **Offline Support**: Works offline, syncs when connection returns
- ✅ **Conflict Resolution**: Uses timestamps to resolve conflicts
- ✅ **No Data Loss**: Local data is preserved during sync

## Setup Instructions

### 1. Create a Supabase Project

1. Go to [supabase.com](https://supabase.com) and sign in
2. Click "New Project"
3. Fill in project details:
   - **Name**: `tempo-tracker` (or any name you prefer)
   - **Database Password**: Choose a strong password (save this!)
   - **Region**: Choose closest to you
4. Click "Create new project"
5. Wait for the project to be provisioned (takes ~2 minutes)

### 2. Get Your API Keys

1. In your Supabase dashboard, go to **Project Settings** → **API**
2. Copy these values:
   - **Project URL**: `https://your-project.supabase.co`
   - **anon public key**: A long string starting with `eyJ...`

⚠️ **IMPORTANT**: Never use the `service_role` key in the frontend! Only use the `anon` key.

### 3. Configure Environment Variables

1. In your project root, create a `.env` file:

```bash
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

2. Replace the values with your actual Project URL and anon key

3. The `.env` file is already in `.gitignore` and will not be committed

### 4. Run Database Migrations

1. In your Supabase dashboard, go to **SQL Editor**
2. Click "New Query"
3. Copy the contents of `supabase/migrations/001_initial_schema.sql`
4. Paste it into the SQL editor
5. Click "Run" (or press Ctrl+Enter)

This creates:
- `profiles` table (user profiles)
- `categories` table (study/other categories)
- `sessions` table (time tracking sessions)
- `segments` table (for continued sessions)
- `laps` table (lap/split data)
- Row Level Security policies
- Automatic profile creation on signup
- Updated_at triggers

### 5. Verify RLS Policies

After running the migration, verify that RLS is enabled:

1. Go to **Authentication** → **Policies**
2. You should see policies for each table
3. Each policy should reference `auth.uid()`

### 6. Test the Setup

1. Start the development server: `npm run dev`
2. Open the app in your browser
3. You should see the login screen
4. Click "Register" and create an account
5. After registration, you'll be logged in automatically
6. Create some sessions
7. Open the app in another browser/device
8. Log in with the same account
9. Your data should sync automatically

## Security Notes

### What's Secure

✅ **anon key in frontend**: This is safe - it's designed for client-side use
✅ **Row Level Security**: Each user can only access their own data
✅ **Environment variables**: Secrets are not committed to git
✅ **HTTPS only**: Supabase enforces HTTPS in production

### What's NOT Secure

❌ **service_role key**: Never put this in frontend code
❌ **Hardcoded credentials**: Always use environment variables
❌ **Committing .env**: It's in .gitignore for a reason

## Data Flow

```
┌─────────────┐
│   Browser   │
│  (IndexedDB)│
└──────┬──────┘
       │
       │ Sync
       ▼
┌─────────────┐
│  Supabase   │
│   (Cloud)   │
└──────┬──────┘
       │
       │ Sync
       ▼
┌─────────────┐
│  Other      │
│  Device     │
└─────────────┘
```

1. **Local-first**: All operations happen on IndexedDB first
2. **Background sync**: Changes are synced to Supabase in the background
3. **Conflict resolution**: Uses `updated_at` timestamps
4. **Offline support**: Works without internet, syncs when reconnected

## Troubleshooting

### "Sync Not Configured" Error

**Problem**: You see "Sync Not Configured" on the login screen

**Solution**: 
- Make sure you created the `.env` file
- Verify `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` are set
- Restart the development server after creating `.env`

### Authentication Errors

**Problem**: Login fails with "Invalid login credentials"

**Solution**:
- Check if email confirmation is required in Supabase
- Go to **Authentication** → **Providers** → **Email**
- Disable "Confirm email" for testing (enable for production)

### Data Not Syncing

**Problem**: Data doesn't appear on other devices

**Solution**:
- Check browser console for sync errors
- Verify RLS policies are enabled
- Check that you're logged in with the same account
- Try manual sync from Settings

### RLS Policy Errors

**Problem**: "new row violates row-level security policy"

**Solution**:
- Verify the migration ran successfully
- Check that `user_id` is being set correctly
- Ensure you're logged in (check `auth.uid()`)

## Migration Guide

### From Local-Only to Cloud Sync

If you have existing local data:

1. **Before enabling sync**: Export your data (Settings → Export)
2. **Enable sync**: Set up Supabase as described above
3. **First login**: The app will create your cloud account
4. **Manual sync**: Go to Settings → Sync → "Sync Now"
5. **Verify**: Check that your data appears in Supabase dashboard

### Conflict Resolution

When the same session is edited on multiple devices:

1. Each edit updates the `updated_at` timestamp
2. During sync, the newer version wins
3. No data is lost - older versions are kept in history

## Performance Tips

### Large Datasets

If you have thousands of sessions:

1. **Index optimization**: The migration includes indexes on `user_id` and `started_at`
2. **Pagination**: The app loads data in chunks
3. **Selective sync**: Only changed data is synced

### Reducing Sync Frequency

By default, sync happens:
- On app start
- When data changes
- Every 30 seconds (if changes pending)

To reduce frequency, modify `SYNC_INTERVAL_MS` in `src/lib/sync.ts`

## Backup and Export

### Automatic Backups

Supabase provides automatic daily backups:
- Go to **Database** → **Backups**
- Point-in-time recovery available
- Backups retained for 7 days (free tier)

### Manual Export

1. Go to Settings → Data → Export
2. Choose JSON format
3. Download the backup file
4. Store it safely

### Import

1. Go to Settings → Data → Import
2. Choose your backup file
3. Select merge strategy:
   - **Merge**: Add new data, skip duplicates
   - **Replace**: Delete all data, import fresh

## Cost Considerations

Supabase free tier includes:
- 500 MB database
- 1 GB file storage
- 50,000 monthly active users
- Unlimited API requests

For most personal use cases, the free tier is sufficient.

## Next Steps

1. ✅ Set up Supabase project
2. ✅ Configure environment variables
3. ✅ Run database migrations
4. ✅ Test authentication
5. ✅ Verify sync works
6. ✅ Enable email confirmation (for production)
7. ✅ Set up custom domain (optional)

## Support

- Supabase Docs: https://supabase.com/docs
- Supabase Discord: https://discord.supabase.com
- Tempo Issues: https://github.com/your-repo/issues

---

**Remember**: Your data is yours. Supabase is just the sync layer. You can always export and use Tempo offline.
