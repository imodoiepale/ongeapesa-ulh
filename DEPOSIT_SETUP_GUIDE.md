# 🚀 Quick Setup Guide - Deposit Feature

## What Was Created

### ✅ 3 New Files

1. **`app/api/gate/deposit/route.ts`** - Deposit API endpoint
2. **`components/ongea-pesa/deposit-dialog.tsx`** - Beautiful deposit popup
3. **`docs/DEPOSIT_FEATURE.md`** - Full documentation

### ✅ 1 Updated File

1. **`components/ongea-pesa/main-dashboard.tsx`** - Added "Add Money" button

## 🔧 Setup Steps

### Step 1: Run Database Migration (Required)

Open your Supabase dashboard and run this SQL:

```sql
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS gate_id INTEGER,
ADD COLUMN IF NOT EXISTS gate_name VARCHAR(255);

CREATE INDEX IF NOT EXISTS idx_profiles_gate_id ON profiles(gate_id);
```

### Step 2: Test the Feature

1. **Restart** your dev server if running
2. **Login** to your app
3. **Click** the new "Add Money" card (green with arrow down icon)
4. **Fill in** your M-Pesa number and amount
5. **Click** "Deposit via M-Pesa"
6. **Check** your phone for M-Pesa prompt

## 💡 Features

### User Experience
- ✅ One-click access from dashboard
- ✅ Phone number auto-saved as default
- ✅ Quick amount presets (50, 100, 500, 1000)
- ✅ Real-time validation
- ✅ Beautiful, modern UI
- ✅ Dark mode support
- ✅ Balance auto-refresh

### Developer Features
- ✅ Type-safe API
- ✅ Phone number validation (Kenyan formats)
- ✅ Amount validation (min KSH 10)
- ✅ Error handling
- ✅ Loading states
- ✅ Success callbacks

## 🎨 UI Preview

### Dashboard Integration
- **New Card:** "Add Money" with green gradient
- **Icon:** Arrow down (deposit icon)
- **Position:** Top-left of quick actions grid

### Deposit Dialog
- **Header:** Green gradient with wallet icon
- **Gate Name:** Displayed prominently
- **Phone Input:** Auto-formatted, saved as default
- **Amount Input:** With KSH symbol
- **Quick Buttons:** 50, 100, 500, 1000 KSH presets
- **Submit Button:** "Deposit via M-Pesa" with loading state
- **Info Tooltip:** Instructions for M-Pesa prompt

## 📱 Phone Number Formats Supported

✅ `0712345678` (Standard)
✅ `0112345678` (Airtel)
✅ `+254712345678` (International)
✅ `+254112345678` (International Airtel)

## 💰 Amount Validation

- **Minimum:** KSH 10
- **Maximum:** No limit (set by external API)
- **Format:** Accepts decimals (e.g., 10.50)

## 🔗 API Endpoint

**URL:** `/api/gate/deposit`
**Method:** POST
**Body:**
```json
{
  "amount": 100,
  "phone": "0712345678"
}
```

## 🐛 Troubleshooting

### Issue: "No payment gate found"
**Fix:** Make sure you've run the gate setup migration and the user has a gate_name.

### Issue: Dialog doesn't open
**Fix:** Check browser console for errors. Verify imports are correct.

### Issue: Phone number not saving
**Fix:** Check `profiles` table has `phone_number` column.

### Issue: Balance not updating
**Fix:** Refresh the page. Check if external API webhook is configured.

## 📚 Documentation

See **`docs/DEPOSIT_FEATURE.md`** for complete documentation including:
- Full API reference
- Technical flow diagrams
- Security considerations
- Future enhancements
- Testing guide

## ✨ Next Steps

1. ✅ Test deposit with real M-Pesa number
2. ⏳ Set up webhook for real-time balance updates
3. ⏳ Add transaction history
4. ⏳ Add deposit notifications
5. ⏳ Add deposit receipts

---

**Everything is ready to use! Just run the database migration and test it out! 🎉**
