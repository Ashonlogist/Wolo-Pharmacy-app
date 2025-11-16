# SMTP Configuration Guide

## What is SMTP?

**SMTP (Simple Mail Transfer Protocol)** is the standard protocol used for sending emails over the internet. Think of it as the "postal service" for emails - it's how your application communicates with email servers to send messages.

## How SMTP Works in This App

The Wolo Pharmacy app uses **Nodemailer** (a Node.js library) to send emails through SMTP servers. When you configure SMTP settings, you're telling the app:
- **Where** to send emails (SMTP server address)
- **How** to authenticate (your email and password)
- **What security** to use (SSL/TLS encryption)

---

## SMTP Configuration Fields Explained

### 1. **SMTP Host** (`smtpHost`)
- **What it is**: The address of the email server that will send your emails
- **Example**: `smtp.gmail.com` (for Gmail)
- **Think of it as**: The post office address where you drop off your mail

**Common SMTP Hosts:**
- **Gmail**: `smtp.gmail.com`
- **Outlook/Hotmail**: `smtp-mail.outlook.com`
- **Yahoo**: `smtp.mail.yahoo.com`
- **Custom/Corporate**: Usually provided by your IT department (e.g., `mail.yourcompany.com`)

### 2. **SMTP Port** (`smtpPort`)
- **What it is**: The "door number" on the server that handles email sending
- **Common ports**:
  - **587**: Most common, uses STARTTLS (recommended)
  - **465**: Uses SSL/TLS directly
  - **25**: Older, less secure (often blocked by ISPs)
- **Default in app**: `587` (recommended)

**Port Selection Guide:**
- Use **587** if "Use SSL/TLS" is checked (STARTTLS)
- Use **465** if you want direct SSL connection
- Use **25** only if your provider requires it (rare)

### 3. **Email** (`smtpUser`)
- **What it is**: Your email address used for authentication
- **Example**: `yourname@gmail.com`
- **Important**: This is the email account that will be used to send emails

### 4. **Password** (`smtpPass`)
- **What it is**: The password for your email account
- **⚠️ CRITICAL**: For Gmail and most modern providers, you **CANNOT** use your regular password
- **You need**: An **App Password** or **Application-Specific Password**

### 5. **Use SSL/TLS** (`smtpSecure`)
- **What it is**: Encrypts the connection between your app and the email server
- **Why it matters**: Protects your password and email content from being intercepted
- **Recommendation**: **Always check this** ✅

**SSL vs TLS:**
- Both provide encryption
- TLS is newer and more secure
- The app uses TLS when this is checked

### 6. **From Email** (`fromEmail`)
- **What it is**: The email address that appears as the sender
- **Usually**: Same as your SMTP User email
- **Can be different**: Some providers allow sending from aliases

### 7. **From Name** (`fromName`)
- **What it is**: The display name shown to recipients
- **Example**: "Wolo Pharmacy" or "Your Pharmacy Name"
- **Optional**: If left empty, just the email address is shown

---

## Step-by-Step Configuration Guide

### For Gmail Users

1. **Enable 2-Step Verification** (Required)
   - Go to [Google Account Security](https://myaccount.google.com/security)
   - Enable "2-Step Verification" if not already enabled

2. **Generate an App Password**
   - Go to [Google App Passwords](https://myaccount.google.com/apppasswords)
   - Select "Mail" and "Other (Custom name)"
   - Enter "Wolo Pharmacy App"
   - Click "Generate"
   - **Copy the 16-character password** (you'll need this)

3. **Configure in Wolo App**
   ```
   SMTP Host: smtp.gmail.com
   SMTP Port: 587
   Email: yourname@gmail.com
   Password: [paste the 16-character app password]
   Use SSL/TLS: ✅ Checked
   From Email: yourname@gmail.com
   From Name: Wolo Pharmacy (or your pharmacy name)
   ```

4. **Test the Configuration**
   - Click "Test Email Settings" button
   - Check your email inbox for a test message
   - If successful, you'll see a success message

### For Outlook/Hotmail Users

1. **Enable App Password** (if 2FA is enabled)
   - Go to [Microsoft Account Security](https://account.microsoft.com/security)
   - If 2FA is enabled, create an app password

2. **Configure in Wolo App**
   ```
   SMTP Host: smtp-mail.outlook.com
   SMTP Port: 587
   Email: yourname@outlook.com (or @hotmail.com)
   Password: [your password or app password]
   Use SSL/TLS: ✅ Checked
   From Email: yourname@outlook.com
   From Name: Wolo Pharmacy
   ```

### For Yahoo Mail Users

1. **Generate App Password**
   - Go to [Yahoo Account Security](https://login.yahoo.com/account/security)
   - Generate an app password

2. **Configure in Wolo App**
   ```
   SMTP Host: smtp.mail.yahoo.com
   SMTP Port: 587
   Email: yourname@yahoo.com
   Password: [app password]
   Use SSL/TLS: ✅ Checked
   From Email: yourname@yahoo.com
   From Name: Wolo Pharmacy
   ```

### For Custom/Corporate Email

Contact your IT department or email provider for:
- SMTP server address
- Port number
- Authentication requirements
- Any special settings needed

---

## How the App Uses SMTP

### Current Implementation

The app stores SMTP settings in the database and uses them when:
1. **Sending test emails** (via "Test Email Settings" button)
2. **Sending reports via email** (from the Reports page)

### How It Works Behind the Scenes

```javascript
// Simplified flow:
1. User configures SMTP settings in Settings page
2. Settings are saved to database (encrypted password)
3. When sending email:
   - App reads SMTP settings from database
   - Creates Nodemailer transporter with those settings
   - Connects to SMTP server
   - Authenticates with email/password
   - Sends the email
   - Returns success/error message
```

### Security Considerations

1. **Password Storage**: 
   - Passwords are stored in the database
   - They should be encrypted (consider adding encryption in future)
   - Never share your database file

2. **App Passwords**:
   - More secure than regular passwords
   - Can be revoked without changing your main password
   - Provider-specific (Gmail, Outlook, etc.)

3. **SSL/TLS**:
   - Always use encryption (check "Use SSL/TLS")
   - Protects data in transit
   - Required by most modern email providers

---

## Troubleshooting Common Issues

### "Authentication Failed" Error

**Possible Causes:**
1. ❌ Using regular password instead of app password (Gmail)
2. ❌ 2-Step Verification not enabled (Gmail)
3. ❌ Incorrect email or password
4. ❌ App password expired or revoked

**Solutions:**
- Generate a new app password
- Verify email address is correct
- Check that 2FA is enabled (for Gmail)

### "Connection Timeout" Error

**Possible Causes:**
1. ❌ Wrong SMTP host address
2. ❌ Firewall blocking port 587
3. ❌ Internet connection issues

**Solutions:**
- Verify SMTP host is correct
- Try port 465 instead of 587
- Check firewall settings
- Test internet connection

### "Port 587 Not Available" Error

**Solutions:**
- Try port 465 with SSL/TLS checked
- Contact your ISP (some block port 587)
- Use a VPN if necessary

### "Email Sent but Not Received"

**Possible Causes:**
1. ❌ Email went to spam folder
2. ❌ Wrong recipient email address
3. ❌ Email provider blocking outgoing emails

**Solutions:**
- Check spam/junk folder
- Verify recipient email is correct
- Check email provider's sending limits

---

## Email Provider Quick Reference

| Provider | SMTP Host | Port | SSL/TLS | Notes |
|----------|-----------|------|---------|-------|
| **Gmail** | `smtp.gmail.com` | 587 | ✅ | Requires App Password |
| **Outlook** | `smtp-mail.outlook.com` | 587 | ✅ | May need App Password |
| **Yahoo** | `smtp.mail.yahoo.com` | 587 | ✅ | Requires App Password |
| **iCloud** | `smtp.mail.me.com` | 587 | ✅ | Requires App Password |
| **Zoho** | `smtp.zoho.com` | 587 | ✅ | Check Zoho settings |
| **Custom** | Varies | 587/465 | ✅ | Contact IT/admin |

---

## Testing Your Configuration

### Using the Test Email Button

1. Fill in all SMTP fields
2. Click "Save Settings"
3. Click "Test Email Settings"
4. Wait for confirmation message
5. Check your email inbox (and spam folder)

### What the Test Email Does

The test email:
- Sends a message to the "From Email" address
- Subject: "Test Email from Wolo Pharmacy"
- Body: Confirmation that SMTP is working
- If successful: Shows success message
- If failed: Shows error details

---

## Future Enhancements (Not Yet Implemented)

The following features could be added:

1. **Email Templates**: Pre-designed email formats for reports
2. **Multiple Recipients**: Send to multiple email addresses
3. **Scheduled Emails**: Automatically send reports on schedule
4. **Email History**: Log of all emails sent
5. **Attachment Support**: Send Excel files as attachments
6. **Email Encryption**: Additional encryption for sensitive data

---

## Security Best Practices

1. ✅ **Always use App Passwords** (not regular passwords)
2. ✅ **Enable SSL/TLS** for all connections
3. ✅ **Keep your database file secure** (it contains passwords)
4. ✅ **Regularly rotate app passwords**
5. ✅ **Don't share SMTP credentials**
6. ✅ **Use strong, unique passwords**

---

## Need Help?

If you're having trouble configuring SMTP:

1. **Check the error message** - it usually tells you what's wrong
2. **Verify all fields** are filled correctly
3. **Test with a different email provider** to isolate the issue
4. **Contact support**: aaronashong111@gmail.com

---

**Remember**: SMTP configuration is a one-time setup. Once configured correctly, you can send emails from the Reports page without re-entering settings!

