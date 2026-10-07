"use client";

import { useState } from "react";
import {
  CURRENCIES,
  FX_SNAPSHOT,
  formatPrice,
  type CurrencyCode,
} from "../content/rates";
import { useDisplayCurrency } from "@/landing/hooks/useDisplayCurrency";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/ui/select";

/** Centipid-style rates this calculator applies, as approved for MylesNet. */
const HOTSPOT_RATE = 0.03;
const PPPOE_FEE_USD = 0.25;

const CURRENCY_SYMBOL: Record<CurrencyCode, string> = {
  KES: "KSh",
  UGX: "USh",
  USD: "$",
};

/**
 * Monthly fee estimator: 3% of monthly hotspot revenue plus $0.25 per active
 * PPPoE subscriber. Both inputs are entered in the display currency; the
 * PPPoE rate is USD and converts through the cached reference-rate snapshot,
 * so no runtime FX call is made.
 */
export default function PricingCalculator() {
  const [currency, setCurrency] = useDisplayCurrency();
  const [revenue, setRevenue] = useState("1000");
  const [subscribers, setSubscribers] = useState("100");

  const revenueAmount = Math.max(0, Number(revenue) || 0);
  const subscriberCount = Math.max(0, Math.floor(Number(subscribers) || 0));

  const perKES = FX_SNAPSHOT.perKES[currency];
  const hotspotFeeKES = (HOTSPOT_RATE * revenueAmount) / perKES;
  const pppoeFeeKES = (subscriberCount * PPPOE_FEE_USD) / FX_SNAPSHOT.perKES.USD;
  const totalKES = hotspotFeeKES + pppoeFeeKES;

  return (
    <div className="landing-estimate">
      <div className="landing-estimate-controls">
        <div className="landing-estimate-field landing-calc-currency">
          <label className="landing-estimate-label" htmlFor="calc-currency">
            Display currency
          </label>
          <Select value={currency} onValueChange={(value) => setCurrency(value as CurrencyCode)}>
            <SelectTrigger id="calc-currency" className="w-full">
              <SelectValue placeholder="Currency" />
            </SelectTrigger>
            <SelectContent>
              {CURRENCIES.map(({ code, label }) => (
                <SelectItem key={code} value={code}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="landing-estimate-inputs">
        <div className="landing-calc-field">
          <label className="landing-estimate-label" htmlFor="calc-revenue">
            Monthly hotspot revenue
          </label>
          <div className="landing-calc-input-wrap">
            <span className="landing-calc-affix" aria-hidden="true">
              {CURRENCY_SYMBOL[currency]}
            </span>
            <input
              id="calc-revenue"
              type="number"
              min={0}
              step={100}
              inputMode="decimal"
              value={revenue}
              onChange={(event) => setRevenue(event.target.value)}
            />
          </div>
          <p className="landing-calc-hint">
            3% of monthly hotspot revenue
          </p>
        </div>

        <div className="landing-calc-field">
          <label className="landing-estimate-label" htmlFor="calc-subscribers">
            Active PPPoE subscribers
          </label>
          <div className="landing-calc-input-wrap">
            <input
              id="calc-subscribers"
              type="number"
              min={0}
              step={10}
              inputMode="numeric"
              value={subscribers}
              onChange={(event) => setSubscribers(event.target.value)}
            />
            <span className="landing-calc-affix" aria-hidden="true">
              active
            </span>
          </div>
          <p className="landing-calc-hint">
            $0.25 per active subscriber each month
          </p>
        </div>
      </div>

      <dl className="landing-estimate-rows">
        <div className="landing-estimate-row">
          <dt>Hotspot revenue fee</dt>
          <dd>{formatPrice(hotspotFeeKES, currency)}</dd>
        </div>
        <div className="landing-estimate-row">
          <dt>PPPoE subscriber fee</dt>
          <dd>{formatPrice(pppoeFeeKES, currency)}</dd>
        </div>
        <div className="landing-estimate-row landing-estimate-total">
          <dt>Estimated total</dt>
          <dd>
            <span className="landing-estimate-total-value">
              {formatPrice(totalKES, currency)}
            </span>
            <span className="landing-estimate-total-period">per month</span>
          </dd>
        </div>
      </dl>

      <p className="landing-estimate-note">
        An estimate only: the hotspot fee follows the revenue confirmed in a
        month, and the PPPoE fee counts the subscribers active during it. A
        minimum monthly payment of KES 500 (Kenya) or USD 5 (other regions)
        applies.
      </p>
    </div>
  );
}
