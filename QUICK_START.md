# Quick Start Guide

## 🚀 What You Need to Connect

### 1. Supabase Credentials
- **Project URL**: Found in Supabase Dashboard > Settings > API
- **Anon Key**: Found in Supabase Dashboard > Settings > API (public key)

### 2. Express Backend
- **API Base URL**: Your Express server URL (e.g., `http://localhost:3000/api/v1`)
- **CORS Configuration**: Must allow requests from Expo dev servers
- **JWT Verification**: Optional but recommended for protected routes

### 3. Environment Variables
Create a `.env` file in the TechLancer folder with:
```env
EXPO_PUBLIC_SUPABASE_URL=your_supabase_url_here
EXPO_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key_here
EXPO_PUBLIC_API_BASE_URL=http://localhost:3000/api/v1
```

## 📦 Installation

```bash
cd TechLancer
npm install
```

## ▶️ Run the App

### 🌐 Run in Browser (Recommended for Development)

**Option 1 - Direct web command:**
```bash
npm run web
```
This will automatically open your app in the browser at `http://localhost:8081` (or similar port).

**Option 2 - Interactive mode:**
```bash
npm start
```
Then press:
- `w` for **web** (opens in browser)
- `i` for iOS simulator (macOS only)
- `a` for Android emulator

### 📱 Other Platforms
- **iOS Simulator**: `npm run ios` (requires macOS and Xcode)
- **Android Emulator**: `npm run android` (requires Android Studio)
- **Physical Device**: Scan the QR code with Expo Go app

## 🔗 Connection Steps

1. **Set up Supabase:**
   - Create project at [supabase.com](https://supabase.com)
   - Get credentials from Settings > API
   - Set up authentication providers
   - Create database tables with RLS policies

2. **Configure Express Backend:**
   - Add CORS middleware (see CONNECTION_SETUP.md)
   - Optionally add JWT verification middleware
   - Ensure API returns JSON in expected format

3. **Set Environment Variables:**
   - Copy `.env.example` to `.env`
   - Fill in your Supabase and API URLs

4. **Test Connection:**
   - Start your Express server
   - Start the Expo app
   - Check console for connection status

## 📚 Documentation

- **Full Setup Guide**: See `CONNECTION_SETUP.md`
- **Main README**: See `README.md`

## 🚢 Deploy to Vercel

1. Set environment variables in Vercel dashboard
2. Connect GitHub repository
3. Vercel will auto-deploy using `vercel.json` config
