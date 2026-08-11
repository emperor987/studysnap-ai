import type { BillingPeriod } from "@/lib/plans";
import { cn } from "@/lib/utils";

/**
 * Bascule de période de facturation (Mensuel / Annuel).
 * Le badge « -17% » correspond aux tarifs annuels (2 mois offerts).
 */
export function BillingToggle({
  value,
  onChange,
}: {
  value: BillingPeriod;
  onChange: (billing: BillingPeriod) => void;
}) {
  return (
    <div
      role="tablist"
      aria-label="Période de facturation"
      className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/8 p-1"
    >
      <button
        type="button"
        role="tab"
        aria-selected={value === "monthly"}
        onClick={() => onChange("monthly")}
        className={cn(
          "rounded-full px-4 py-2 text-sm font-semibold transition-all",
          value === "monthly"
            ? "bg-primary text-primary-foreground shadow-md"
            : "text-muted-foreground hover:text-foreground",
        )}
      >
        Mensuel
      </button>
      <button
        type="button"
        role="tab"
        aria-selected={value === "annual"}
        onClick={() => onChange("annual")}
        className={cn(
          "flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-semibold transition-all",
          value === "annual"
            ? "bg-primary text-primary-foreground shadow-md"
            : "text-muted-foreground hover:text-foreground",
        )}
      >
        Annuel
        <span
          className={cn(
            "rounded-full px-1.5 py-0.5 text-[10px] font-bold leading-none",
            value === "annual"
              ? "bg-white/20 text-white"
              : "bg-mint-500/15 text-mint-300",
          )}
          title="2 mois offerts sur l'année"
        >
          -17%
        </span>
      </button>
    </div>
  );
}
