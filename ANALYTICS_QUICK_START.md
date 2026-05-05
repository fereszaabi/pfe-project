# Analytics System - Quick Start Guide

## 🚀 Getting Started

### Step 1: Verify Database Fields
Ensure your `demandes` table has these fields:
- `assigned_at` (timestamp, nullable)
- `completed_at` (timestamp, nullable)  
- `client_rating` (integer/float, nullable)

If missing, run migrations or add manually.

### Step 2: Access Analytics Dashboard
1. Login as **Admin user**
2. On Admin Dashboard, click **"Analytics & Reports"** button in sidebar
3. You'll see the analytics interface

### Step 3: Select Date Range
- Use the date pickers in the top header
- Default is last 30 days
- All metrics update automatically

### Step 4: Explore Tabs

#### **KPI Metrics Tab** (Default)
Shows 4 key cards:
- ⏱️ Avg First Response Time
- ✅ Avg Resolution Time  
- 📅 Backlog Age
- ⭐ CSAT Score

Plus:
- Resolution Rate % (visual progress bar)
- SLA Compliance %
- Current Backlog Count
- Status Distribution chart

#### **Trends Tab**
Select metric from buttons:
- **TICKETS** - Created vs Resolved daily
- **RESOLUTION_TIME** - Avg hours per day
- **FIRST_RESPONSE** - Avg response hours
- **CSAT** - Customer satisfaction over time
- **BACKLOG** - Workload aging

Charts auto-update based on selection.

#### **Agent Workload Tab**
Shows each agent as a card with:
- 📊 Resolution Rate %
- 🎯 Assigned/Resolved/Pending counts
- ⏱️ Avg Resolution Hours
- ⭐ Avg Customer Rating
- 📋 Current Workload

#### **Backlog Tab**
Displays:
- Critical metrics cards (total, under 24h, 1-3 days, 7+ days)
- Priority breakdown bar chart
- Oldest ticket age warning
- Critical ticket count

### Step 5: Export Report
Click **"Export"** button → Select format (JSON)
→ File downloads as `analytics_report_YYYY-MM-DD.json`

## 📊 Understanding Metrics

### First Response Time (Target: < 2 hours)
- How quickly your team responds to new tickets
- Calculated: Time from ticket creation to assignment
- ✅ Good: < 1 hour | ⚠️ Warning: 2-4 hours | ❌ Critical: > 4 hours

### Resolution Time (Target: < 4 hours)
- How long it takes to resolve each ticket
- Calculated: Time from assignment to completion
- ✅ Good: < 2 hours | ⚠️ Warning: 4-8 hours | ❌ Critical: > 24 hours

### Backlog Age (Target: < 3 days)
- How old tickets are sitting unresolved
- Helps identify stale tickets
- ✅ Good: < 1 day | ⚠️ Warning: 3-7 days | ❌ Critical: > 7 days

### CSAT Score (Target: > 4.0 / 5.0)
- Customer satisfaction rating
- Based on ratings given after ticket completion
- ✅ Good: > 4.5 | ⚠️ Warning: 3-4.5 | ❌ Critical: < 3

### Resolution Rate (Target: > 90%)
- Percentage of tickets successfully resolved
- Shows team efficiency
- ✅ Good: > 95% | ⚠️ Warning: 80-95% | ❌ Critical: < 80%

## 🎯 Quick Tips

1. **Compare Periods**: Change date range to see improvements
2. **Identify Bottlenecks**: Check which agent has longest resolution time
3. **Watch Backlog**: Action if oldest ticket > 7 days
4. **Monitor CSAT**: If score drops, review recent tickets
5. **Balance Workload**: Use agent cards to see who is overloaded

## 🔍 Troubleshooting

**No data showing?**
- Check date range includes recent tickets
- Ensure tickets have assigned_at timestamps
- Verify you're logged in as admin

**Charts not loading?**
- Refresh the page
- Clear browser cache
- Check console for errors (F12)

**Export not working?**
- Try refreshing page first
- Check browser download folder
- Try JSON format instead of CSV

## 📈 Recommended Uses

### Daily
- Check backlog tab for > 7 day old tickets
- Monitor active agent workload
- Watch CSAT score

### Weekly  
- Review resolution time trends
- Compare first response times
- Check SLA compliance

### Monthly
- Deep dive into all metrics
- Export full reports
- Compare vs. previous month
- Plan team adjustments

## 🚨 Critical Alerts

Watch for these red flags:

| Alert | Action |
|-------|--------|
| Backlog > 50 tickets | Assign more staff or prioritize |
| Oldest ticket > 14 days | Escalate immediately |
| CSAT < 3.0 | Review recent tickets for issues |
| First Response > 8 hours | Check staffing/availability |
| Agent workload > 10 | Redistribute tickets |

## 📞 Support

If analytics data seems wrong:
1. Check that tickets have proper timestamps
2. Verify assigned_at is set when ticket assigned
3. Verify completed_at is set when ticket resolved
4. Refresh your browser (F5)
5. Check browser console for errors (F12 → Console)

---

**Last Updated**: May 3, 2026
**Version**: 1.0
