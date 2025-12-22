# Google Ads API Credentials Setup Guide

## Error: "The OAuth client was not found"

This error means your `GOOGLE_ADS_CLIENT_ID` or `GOOGLE_ADS_CLIENT_SECRET` is incorrect or missing.

## Steps to Fix

### 1. Verify Your .dev.vars File

Open `.dev.vars` and ensure all values are filled in (not placeholders):

```bash
GOOGLE_ADS_CLIENT_ID=123456789-abcdefghijklmnop.apps.googleusercontent.com
GOOGLE_ADS_CLIENT_SECRET=GOCSPX-xxxxxxxxxxxxxxxxxxxxx
GOOGLE_ADS_REFRESH_TOKEN=1//xxxxxxxxxxxxxxxxxxxxx
GOOGLE_ADS_DEVELOPER_TOKEN=xxxxxxxxxxxxx
GOOGLE_ADS_LOGIN_CUSTOMER_ID=1234567890
```

**Important**: 
- Remove any quotes around the values
- No spaces around the `=` sign
- Values should NOT include `your_xxx_here` placeholders

### 2. Get Your OAuth Credentials

If you don't have credentials yet:

1. **Go to Google Cloud Console**: https://console.cloud.google.com/
2. **Select your project** (or create a new one)
3. **Enable Google Ads API**:
   - Go to "APIs & Services" > "Library"
   - Search for "Google Ads API"
   - Click "Enable"
4. **Create OAuth 2.0 Credentials**:
   - Go to "APIs & Services" > "Credentials"
   - Click "Create Credentials" > "OAuth client ID"
   - Application type: **Desktop app**
   - Name it (e.g., "Google Ads MCP")
   - Click "Create"
   - Copy the **Client ID** and **Client Secret**

### 3. Generate Refresh Token

You need to generate a refresh token using OAuth flow:

**Option A: Using Google Ads API Python Library**
```bash
# Install the library
pip install google-ads

# Run the authentication example
python -m google.ads.googleads.examples.authentication.authenticate_in_desktop_application
```

**Option B: Using OAuth 2.0 Playground**
1. Go to https://developers.google.com/oauthplayground/
2. In the left panel, find "Google Ads API"
3. Select scopes (usually just the default)
4. Click "Authorize APIs"
5. After authorization, click "Exchange authorization code for tokens"
6. Copy the **Refresh token**

### 4. Get Developer Token

1. **Sign in to Google Ads**: https://ads.google.com/
2. **Go to Tools & Settings** (wrench icon)
3. **Click "API Center"** under "Setup"
4. **Apply for a developer token** (if you don't have one)
   - Approval can take 24-48 hours
5. **Copy your Developer Token**

### 5. Restart Your Dev Server

After updating `.dev.vars`:

1. Stop the dev server (Ctrl+C)
2. Restart it:
   ```bash
   npm run dev
   ```
3. Try your request again in Postman

## Common Issues

### Issue: "invalid_client" Error
- **Cause**: Wrong Client ID or Client Secret
- **Solution**: Double-check credentials in Google Cloud Console match your `.dev.vars`

### Issue: "invalid_grant" Error
- **Cause**: Refresh token expired or incorrect
- **Solution**: Generate a new refresh token

### Issue: Credentials Not Loading
- **Cause**: `.dev.vars` file not in project root or wrong format
- **Solution**: 
  - Ensure `.dev.vars` is in the same directory as `package.json`
  - Check for typos in variable names
  - Ensure no extra spaces or quotes

### Issue: Developer Token Not Approved
- **Cause**: Developer token still pending approval
- **Solution**: Wait for approval or use test account with approved token

## Verification Checklist

- [ ] `.dev.vars` file exists in project root
- [ ] All 5 variables are set (login_customer_id is optional)
- [ ] No placeholder values (`your_xxx_here`)
- [ ] Client ID format: `xxxxx.apps.googleusercontent.com`
- [ ] Client Secret format: `GOCSPX-xxxxx`
- [ ] Developer token is approved
- [ ] Refresh token was generated recently
- [ ] Dev server restarted after updating `.dev.vars`

## Testing Without Credentials

You can test these tools without credentials:
- ✅ `get_gaql_doc` - Returns documentation
- ✅ `get_reporting_view_doc` - Returns documentation
- ✅ `tools/list` - Lists available tools

These tools require valid credentials:
- ❌ `list_accessible_accounts` - Needs OAuth credentials
- ❌ `execute_gaql` - Needs OAuth credentials + Developer Token

## Need Help?

If you're still having issues:
1. Check the server console logs for detailed error messages
2. Verify each credential individually in Google Cloud Console
3. Try generating new OAuth credentials
4. Ensure your Google Cloud project has Google Ads API enabled

