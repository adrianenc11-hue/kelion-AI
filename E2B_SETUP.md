# 🔑 E2B SETUP GUIDE

**E2B** provides secure sandboxed environments for code execution.

---

## STEP 1: CREATE E2B ACCOUNT

1. Go to: <https://e2b.dev>
2. Click "Sign Up" (free tier available)
3. Sign up with GitHub or email

**Free Tier Limits:**

- 500 sandbox hours/month
- Unlimited sandboxes
- All features included

---

## STEP 2: GET API KEY

1. After signup, go to Dashboard
2. Click "API Keys" in sidebar
3. Click "Create API Key"
4. Copy the key (starts with `e2b_`)

**Example:** `e2b_1234567890abcdef1234567890abcdef`

---

## STEP 3: ADD TO NETLIFY

**Option A: Netlify CLI** (Recommended)

```bash
cd "C:\Users\adria\Downloads\k new\kelionat_clean"
netlify env:set E2B_API_KEY "your-api-key-here"
```

**Option B: Netlify Dashboard**

1. Go to: <https://app.netlify.com>
2. Select your site (kelionai-app)
3. Go to "Site settings" → "Environment variables"
4. Click "Add a variable"
5. Key: `E2B_API_KEY`
6. Value: (paste your API key)
7. Click "Save"

---

## STEP 4: VERIFY INSTALLATION

After deploying, test with this Python code:

```python
print("Hello from K!")
import sys
print(f"Python version: {sys.version}")
```

Expected output:

```
Hello from K!
Python version: 3.11.x
```

---

## TROUBLESHOOTING

**Error: "E2B API key not configured"**

- Make sure you added `E2B_API_KEY` to Netlify env vars
- Redeploy after adding env var

**Error: "Invalid E2B API key"**

- Check that API key is correct (starts with `e2b_`)
- Generate new API key in E2B dashboard

**Error: "Timeout"**

- Code took > 30 seconds
- Optimize code or increase timeout in code-execution.js

---

## NEXT STEPS

1. ✅ Create E2B account
2. ✅ Get API key
3. ✅ Add to Netlify environment
4. ✅ Deploy to production
5. ✅ Test code execution

---

**Documentation:** <https://e2b.dev/docs>
**Support:** <support@e2b.dev>
