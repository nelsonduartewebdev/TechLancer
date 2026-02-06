# TechLancer - React Native + Expo App

A React Native application built with Expo that connects to an Express + Supabase backend.

## 🚀 Getting Started

### Prerequisites

- Node.js (v18 or higher)
- npm or yarn
- Expo CLI (`npm install -g expo-cli`)
- Supabase account and project
- Express backend API running

### Installation

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Set up environment variables:**
   - Copy `.env.example` to `.env`
   - Fill in your Supabase credentials and API URL:
     ```env
     EXPO_PUBLIC_SUPABASE_URL=your_supabase_project_url
     EXPO_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
     EXPO_PUBLIC_API_BASE_URL=http://localhost:3000/api/v1
     ```

3. **Start the development server:**
   ```bash
   npm start
   ```

## 📱 Running the App

- **Web:** `npm run web` or press `w` in the Expo CLI
- **iOS Simulator:** `npm run ios` or press `i` (requires macOS and Xcode)
- **Android Emulator:** `npm run android` or press `a` (requires Android Studio)
- **Physical Device:** Scan the QR code with Expo Go app

## 🔌 Backend Connection Setup

### What You Need to Connect:

1. **Supabase Project:**
   - Project URL (found in Supabase Dashboard > Settings > API)
   - Anon/Public Key (found in Supabase Dashboard > Settings > API)
   - Ensure Row Level Security (RLS) policies are configured
   - Set up authentication providers if needed

2. **Express API:**
   - Base URL (e.g., `http://localhost:3000/api/v1` for development)
   - CORS configuration to allow requests from your app
   - Authentication endpoints (if using custom auth)
   - API endpoints matching the structure in `lib/api.ts`

### Express Backend Requirements:

Your Express backend should:

1. **Enable CORS:**
   ```javascript
   const cors = require('cors');
   app.use(cors({
     origin: ['http://localhost:8081', 'http://localhost:19006'], // Expo default ports
     credentials: true
   }));
   ```

2. **Handle Supabase Auth Tokens:**
   - Verify JWT tokens from Supabase in your middleware
   - Extract user information from the token

3. **API Structure:**
   - Follow RESTful conventions
   - Return JSON responses in the format:
     ```json
     {
       "success": true,
       "data": { ... },
       "message": "Optional message"
     }
     ```

### Supabase Setup:

1. **Create a Supabase project** at [supabase.com](https://supabase.com)

2. **Get your credentials:**
   - Go to Settings > API
   - Copy the Project URL and anon/public key

3. **Configure Authentication:**
   - Set up email/password authentication
   - Configure any additional providers (Google, GitHub, etc.)
   - Set up email templates if needed

4. **Database Setup:**
   - Create your database tables
   - Set up Row Level Security (RLS) policies
   - Create any necessary functions or triggers

## 🚢 Deployment to Vercel

This app is configured for web deployment on Vercel. Note: React Native apps are typically deployed as mobile apps, but Expo supports web builds which can be deployed to Vercel.

### Steps:

1. **Install Vercel CLI (optional):**
   ```bash
   npm i -g vercel
   ```

2. **Build for web:**
   ```bash
   npm run build:web
   ```

3. **Deploy to Vercel:**
   - Connect your GitHub repository to Vercel
   - Or use Vercel CLI: `vercel`
   - Set environment variables in Vercel dashboard:
     - `EXPO_PUBLIC_SUPABASE_URL`
     - `EXPO_PUBLIC_SUPABASE_ANON_KEY`
     - `EXPO_PUBLIC_API_BASE_URL`

4. **Vercel Configuration:**
   - The `vercel.json` file is already configured
   - Build command: `npm run build:web`
   - Output directory: `web-build`

### Environment Variables in Vercel:

Go to your Vercel project settings and add:
- `EXPO_PUBLIC_SUPABASE_URL`
- `EXPO_PUBLIC_SUPABASE_ANON_KEY`
- `EXPO_PUBLIC_API_BASE_URL` (your production API URL)

## 📁 Project Structure

```
TechLancer/
├── app/                    # Expo Router app directory
│   ├── (tabs)/            # Tab navigation screens
│   ├── _layout.tsx        # Root layout
│   └── index.tsx          # Entry screen
├── lib/                    # Utilities and services
│   ├── api.ts             # Express API client
│   ├── auth.ts            # Supabase auth service
│   └── supabase.ts        # Supabase client
├── assets/                 # Images, fonts, etc.
├── app.json               # Expo configuration
├── app.config.js          # Expo config with env vars
├── package.json           # Dependencies
├── tsconfig.json          # TypeScript config
└── vercel.json            # Vercel deployment config
```

## 🔐 Authentication Flow

The app uses Supabase for authentication:

1. **Sign Up/Sign In:** Users authenticate through Supabase
2. **Session Management:** Sessions are stored in AsyncStorage
3. **API Requests:** Auth tokens are automatically added to API requests via interceptors
4. **State Management:** Use `authService.onAuthStateChange()` to listen to auth changes

## 📚 Key Files

- `lib/supabase.ts` - Supabase client configuration
- `lib/api.ts` - Express API client with auth interceptors
- `lib/auth.ts` - Authentication service wrapper
- `app/_layout.tsx` - Root layout with navigation
- `.env.example` - Environment variables template

## 🛠️ Development Tips

- Use `expo-router` for file-based routing
- Environment variables must be prefixed with `EXPO_PUBLIC_` to be accessible in the app
- The API client automatically includes auth tokens in requests
- Supabase sessions are persisted using AsyncStorage

## 📝 Next Steps

1. Set up your Supabase project and get credentials
2. Configure your Express backend with CORS
3. Update environment variables
4. Customize the app screens and add your features
5. Test the connection between app and backend
6. Deploy to Vercel when ready

## 🐛 Troubleshooting

- **Connection issues:** Check that your API URL is correct and CORS is configured
- **Auth not working:** Verify Supabase credentials and RLS policies
- **Build errors:** Make sure all environment variables are set
- **Vercel deployment:** Ensure build command and output directory are correct

## 📄 License

MIT
