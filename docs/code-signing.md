# 🎓 Sensi Lessons: Code Signing

> **"A signed binary is a trusted binary. A leaked certificate is a broken company."** — The Jenny Sensi

So, you've built your Jenny app. It's beautiful, it's fast, and it works perfectly. But when you send the `.exe` to your customers, Windows screams at them: **"Windows protected your PC — Publisher Unknown."**

To fix this, you need **Code Signing**. Here is the Sensi's guide to doing it right, and keeping your secrets safe.

---

## 🔒 1. Secrets of the `.gitignore`

**CRITICAL RULE**: Never, ever, commit your code-signing certificate (`.p12` or `.pfx`) or your passwords to GitHub. Use a local `.env` file that is excluded from the repository.

### Ensure your `.gitignore` includes:
```text
# Secrets
*.p12
*.pfx
.env
```

---

## 🔑 2. Choosing Your Certificate

There are two main paths:

1.  **Standard Code Signing**: Cheaper ($100-$300/yr). Requires some identity verification. It *eventually* builds reputation, but initially, SmartScreen might still flag your app for a few weeks.
2.  **EV (Extended Validation) Code Signing**: Expensive ($500-$900/yr). Requires a physical USB token (YubiKey) or a Hardware Security Module (HSM). This grants **immediate reputation**. SmartScreen will never flag an EV-signed app.

**Sensi Recommends**: [DigiCert](https://www.digicert.com/) or [Sectigo](https://sectigo.com/) for professional use.

---

## 🚀 3. Configuring Jenny (Electron Builder)

Jenny uses `electron-builder` under the hood. You don't need to change `jenny.config.json` manually if you use **Environment Variables**.

When you run `jenny package`, `electron-builder` automatically looks for these variables:

### For Standard (P12 file):
Add these to your local, uncommitted `.env` file:
```bash
# Path to your .p12 certificate file (absolute or relative to project root)
CSC_LINK="C:/Users/You/Secrets/certificate.p12"

# The password you set for the certificate
CSC_KEY_PASSWORD="your-very-secure-password"
```

### For EV (Hardware Token):
For EV, you typically use a tool like [SafeNet Authentication Client](https://www.thalesgroup.com/) and let `electron-builder` find it via the Windows Certificate Store by specifying the subject name:
```bash
# Provide the identity name as it appears on your certificate
WIN_CSC_NAME="Interchained LLC"
```

---

## 🧪 4. Testing Your Signature

After running `jenny package`, you can verify the signature on your generated `.exe`:

1.  Right-click the `.exe` in `dist/`.
2.  Select **Properties**.
3.  Check the **Digital Signatures** tab.
4.  It should list **Interchained LLC** as the signer.

---

## 🛡️ 5. Pro-Tip: CI/CD Signing

If you build your apps on GitHub Actions:
1.  Base64 encode your `.p12` file.
2.  Store the Base64 string in **GitHub Secrets** (e.g., `CSC_BASE64`).
3.  Store the password in **GitHub Secrets** (e.g., `CSC_KEY_PASSWORD`).
4.  Your build workflow can then decode the certificate on-the-fly and sign the binary securely.

---

## 💸 6. Can I do this for free?

**Short answer: No, you can't get "Trusted" status for free.**

Technically, you can **Self-Sign** your app for $0. This adds a digital signature, but because no trusted authority (like DigiCert) has verified your identity, Windows will still show the "Publisher Unknown" warning.

### Why does it cost money?
Windows doesn't just check if the app is "signed" — it checks **WHO** signed it and if that person/company has been verified. Verifying a legal entity (like Interchained LLC) costs human time and overhead for the Certificate Authorities, which is why they charge for it.

### Your Best Options:
*   **The "Free" way (Self-Signed)**: Good for testing. Use PowerShell or OpenSSL to create a `.pfx`. It stops "corrupted file" warnings, but doesn't stop "Unknown Publisher" warnings.
*   **The "Budget" way (Azure Trusted Signing)**: Microsoft's new service. It costs roughly **$5/month**. It's the cheapest way to get real reputation, but requires an Azure subscription and identity validation.
*   **The "Pro" way (Standard/EV)**: As mentioned above. Best for long-term commercial software.

---

Now go forth, Sensi, and ship your signed masterpieces with confidence! 🧬
