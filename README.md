# Pay Equipment

Credit ledger with reserves for the Cocapn fleet. Formal backend for the 5-credit visitor system.

## How It Works
- Visitors get **5 free credits** (~$0.0002 cost to Casey)
- **Ad bonus**: +3 credits per ad view
- **Tutorial bonus**: +2 credits per tutorial completion
- **Reserve & release** for pending operations
- **Auto-seat cap**: Free users pay 20% markup until $12/mo spent, then auto-upgrade to Standard
- **Honest cost display**: Always show actual cost to visitors

## Pricing Tiers
| Tier | Price | Markup | Requests |
|------|-------|--------|----------|
| Free | $0 | 20% | 50/day |
| Standard | $5/mo | 2% | 5K/day |
| Gold | $15/mo | 0% | Unlimited |
| Enterprise | $50/seat/mo | 0% | Unlimited + SLA |

## Integration
```typescript
import { CreditLedger } from "./pay-equipment";

const ledger = new CreditLedger();
ledger.visitorCredits("visitor-123");
ledger.spend("visitor-123", 1, "chat message"); // true
ledger.costBreakdown("visitor-123"); // { available: 4, costPerCredit: 0.00004, estimatedCost: 0.00016 }
```

## Persistence
Export/import accounts and transactions as JSON for KV storage. Zero dependencies.

Superinstance & Lucineer (DiGennaro et al.)
