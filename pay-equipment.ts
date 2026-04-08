// pay-equipment.ts — Credit Ledger with Reserves for Cocapn fleet
// Extracted from nexus Pay brick, adapted for our credit system
// Zero deps, ~200 lines

export interface CreditAccount {
  id: string;
  balance: number;
  reserved: number;
  totalEarned: number;
  totalSpent: number;
  createdAt: string;
  tier: "free" | "standard" | "gold" | "enterprise";
}

export interface CreditTransaction {
  id: string;
  accountId: string;
  amount: number;       // positive = credit, negative = debit
  type: "earned" | "spent" | "reserved" | "released" | "bonus" | "refund";
  description: string;
  timestamp: string;
  balance: number;      // balance after transaction
}

export interface PricingTier {
  name: string;
  monthlyPrice: number;
  costMarkup: number;   // e.g., 0.20 = 20% markup
  maxRequests: number;
  seatCap: number;      // auto-upgrade threshold
  features: string[];
}

export const PRICING_TIERS: Record<string, PricingTier> = {
  free: { name: "Free", monthlyPrice: 0, costMarkup: 0.20, maxRequests: 50, seatCap: 0, features: ["5 credits/visitor", "ads", "basic models"] },
  standard: { name: "Standard", monthlyPrice: 5, costMarkup: 0.02, maxRequests: 5000, seatCap: 12, features: ["2% markup", "priority queue"] },
  gold: { name: "Gold", monthlyPrice: 15, costMarkup: 0.0, maxRequests: Infinity, seatCap: 12, features: ["at cost", "Docker containers", "unlimited"] },
  enterprise: { name: "Enterprise", monthlyPrice: 50, costMarkup: 0.0, maxRequests: Infinity, seatCap: 12, features: ["at cost", "SLA", "custom domains", "white-label"] },
};

const CREDIT_COST = 0.00004; // ~$0.00004 per credit (DeepSeek)
const FREE_CREDITS = 5;
const AD_BONUS = 3;
const TUTORIAL_BONUS = 2;

export class CreditLedger {
  private accounts: Map<string, CreditAccount> = new Map();
  private transactions: CreditTransaction[] = [];
  private txCounter = 0;

  private nextTxId(): string { return `tx_${++this.txCounter}`; }

  getAccount(id: string): CreditAccount {
    if (!this.accounts.has(id)) {
      this.accounts.set(id, {
        id, balance: FREE_CREDITS, reserved: 0,
        totalEarned: FREE_CREDITS, totalSpent: 0,
        createdAt: new Date().toISOString(), tier: "free",
      });
    }
    return this.accounts.get(id)!;
  }

  available(id: string): number {
    const acct = this.getAccount(id);
    return acct.balance - acct.reserved;
  }

  spend(id: string, amount: number, description: string): CreditTransaction | null {
    const acct = this.getAccount(id);
    const avail = acct.balance - acct.reserved;
    if (avail < amount) return null;

    acct.balance -= amount;
    acct.totalSpent += amount;

    const tx: CreditTransaction = {
      id: this.nextTxId(), accountId: id, amount: -amount,
      type: "spent", description, timestamp: new Date().toISOString(),
      balance: acct.balance,
    };
    this.transactions.push(tx);

    // Auto-seat cap: light users pay markup until $12/month, then upgrade
    if (acct.tier === "free" && acct.totalSpent * CREDIT_COST >= 12) {
      acct.tier = "standard";
    }

    return tx;
  }

  earn(id: string, amount: number, description: string): CreditTransaction {
    const acct = this.getAccount(id);
    acct.balance += amount;
    acct.totalEarned += amount;

    const tx: CreditTransaction = {
      id: this.nextTxId(), accountId: id, amount,
      type: "earned", description, timestamp: new Date().toISOString(),
      balance: acct.balance,
    };
    this.transactions.push(tx);
    return tx;
  }

  // Reserve credits for a pending operation
  reserve(id: string, amount: number, description: string): boolean {
    const acct = this.getAccount(id);
    if (this.available(id) < amount) return false;
    acct.reserved += amount;

    this.transactions.push({
      id: this.nextTxId(), accountId: id, amount: -amount,
      type: "reserved", description, timestamp: new Date().toISOString(),
      balance: acct.balance,
    });
    return true;
  }

  // Release reserved credits
  release(id: string, amount: number, description: string): void {
    const acct = this.getAccount(id);
    acct.reserved = Math.max(0, acct.reserved - amount);
    acct.balance += amount;

    this.transactions.push({
      id: this.nextTxId(), accountId: id, amount,
      type: "released", description, timestamp: new Date().toISOString(),
      balance: acct.balance,
    });
  }

  // Give free credits to visitor
  visitorCredits(id: string): CreditTransaction {
    return this.earn(id, FREE_CREDITS, "free visitor credits");
  }

  // Ad view bonus
  adBonus(id: string): CreditTransaction {
    return this.earn(id, AD_BONUS, "ad view bonus");
  }

  // Tutorial completion bonus
  tutorialBonus(id: string): CreditTransaction {
    return this.earn(id, TUTORIAL_BONUS, "tutorial completion bonus");
  }

  // Get transaction history
  history(id: string, limit = 20): CreditTransaction[] {
    return this.transactions.filter(t => t.accountId === id).slice(-limit);
  }

  // Honest cost display
  costBreakdown(id: string): { available: number; costPerCredit: number; estimatedCost: number } {
    const acct = this.getAccount(id);
    return {
      available: this.available(id),
      costPerCredit: CREDIT_COST,
      estimatedCost: Math.round(this.available(id) * CREDIT_COST * 1000000) / 1000000,
    };
  }

  // Fleet-wide stats
  fleetStats(): { totalAccounts: number; totalCredits: number; totalSpent: number; totalEarned: number } {
    let totalCredits = 0, totalSpent = 0, totalEarned = 0;
    for (const [, acct] of this.accounts) {
      totalCredits += acct.balance;
      totalSpent += acct.totalSpent;
      totalEarned += acct.totalEarned;
    }
    return { totalAccounts: this.accounts.size, totalCredits, totalSpent, totalEarned };
  }

  exportState(): string {
    return JSON.stringify({
      accounts: Object.fromEntries(this.accounts),
      transactions: this.transactions,
    });
  }

  importState(json: string): void {
    const data = JSON.parse(json);
    if (data.accounts) {
      for (const [k, v] of Object.entries(data.accounts)) {
        this.accounts.set(k, v as CreditAccount);
      }
    }
    if (data.transactions) {
      this.transactions = data.transactions;
    }
  }
}
