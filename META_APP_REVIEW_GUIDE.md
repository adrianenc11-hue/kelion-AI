# Meta App Review — Step-by-Step Guide

## Current Status

The Kelion AI Facebook app is in **Development Mode**.
To enable Messenger webhook for all users, the app must pass Meta App Review.

## Prerequisites

1. ✅ Facebook Page created and linked
2. ✅ Messenger webhook (`messenger-webhook.js`) deployed
3. ✅ Webhook verification endpoint working
4. ⬜ App must be registered at [developers.facebook.com](https://developers.facebook.com)

## Steps to Complete Meta App Review

### Step 1: App Settings

1. Go to [Meta Developer Dashboard](https://developers.facebook.com/apps/)
2. Select the Kelion AI app
3. Fill ALL required fields:
   - App Display Name: **Kelion AI**
   - App Icon: Upload Kelion logo
   - Privacy Policy URL: `https://kelionai.app/privacy.html`
   - Terms of Service URL: `https://kelionai.app/terms.html`
   - Category: **Business**
   - App Purpose: **Provide AI-powered customer support and assistance**

### Step 2: Configure Messenger Platform

1. Go to **Products → Messenger → Settings**
2. Add Facebook Page → Select your page
3. Generate Page Access Token → Save as `META_PAGE_ACCESS_TOKEN` in Supabase vault
4. Configure Webhook:
   - Callback URL: `https://kelionai.app/.netlify/functions/messenger-webhook`
   - Verify Token: Value from `META_VERIFY_TOKEN` env var
   - Subscribe to: `messages`, `messaging_postbacks`, `messaging_optins`

### Step 3: Permissions Required

Request these permissions in App Review:

1. **pages_messaging** — Send and receive messages
2. **pages_read_engagement** — Read page engagement data
3. **pages_manage_metadata** — Manage page metadata

### Step 4: Submit for Review

1. For each permission, provide:
   - **Detailed description** of how the permission is used
   - **Screencast video** showing the feature in action
   - **Step-by-step instructions** for the reviewer
2. Example description for `pages_messaging`:
   > "Kelion AI uses Messenger to provide AI-powered customer support. When a user sends a message to our Facebook Page, our webhook receives the message, processes it through our AI engine, and sends back a helpful response. This enables 24/7 automated support for our users."

### Step 5: After Approval

1. Switch app from Development Mode to **Live Mode**
2. Verify webhook receives messages from non-tester accounts
3. Monitor `messenger-webhook.js` logs for errors

## Required Environment Variables

| Variable | Where to Set | Purpose |
|----------|-------------|---------|
| `META_PAGE_ACCESS_TOKEN` | Supabase vault | Facebook Page token |
| `META_PAGE_ID` | Supabase vault | Facebook Page ID |
| `META_VERIFY_TOKEN` | Supabase vault | Webhook verification |
| `META_APP_SECRET` | Supabase vault | App secret for validation |

## Troubleshooting

- **Webhook not receiving:** Check subscription status in Meta dashboard
- **Token expired:** Generate new Page Access Token (use long-lived token)
- **Review rejected:** Read rejection reason, update description/video, resubmit
