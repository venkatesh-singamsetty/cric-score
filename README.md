# 🏏 CricGenius Scorer

A modern, high-performance cricket scoring application designed for real-time match tracking. Built with **React 19**, **Vite**, and **Tailwind CSS**.

---

## 📋 Prerequisites

Before you begin, ensure you have the following installed on your system:

- **Node.js**: `v24.12.0` (Recommended) or `v18.0.0+`
- **npm**: `v11.6.2` (Recommended) or `v9.0.0+`

> [!TIP]
> You can check your versions by running `node -v` and `npm -v` in your terminal.

---

## 🚀 Quick/Fast Start (One-Step Run)

Copy and paste this command into your terminal to **install dependencies and start the app** immediately:

```bash
npm install && npm run dev
```

- **Visit in Browser:** [http://localhost:3000](http://localhost:3000)

---

## 🏗️ Step-by-Step Production Workflow

If you want to build the final production-ready app:

### 1. Download Dependencies
```bash
npm install
```

### 2. Build the Application
```bash
npm run build
```

### 3. Run and Preview
```bash
npm run preview
```

The production version will be available at **[http://localhost:4173](http://localhost:4173)**.

---

## ☁️ Deployment Guide (AWS)

### Option 1: AWS Amplify (Easiest)
1. Connect your **GitHub** repository to **AWS Amplify Console**.
2. Amplify will auto-detect the Vite settings.
3. Click "Deploy". It will automatically manage the build and hosting.

### Option 2: S3 + CloudFront (Static)
1. Run `npm run build`.
2. Upload everything from the `dist/` directory to an **S3 Bucket** configured for static web hosting.
3. (Optional) Set up **CloudFront** to serve the content via HTTPS.

---

## 🛠️ Tech Stack & Credits

- **Frontend**: React 19
- **Styling**: Tailwind CSS
- **Charts**: Recharts
- **Bundler**: Vite 6

Developed with ❤️ using Antigravity.
