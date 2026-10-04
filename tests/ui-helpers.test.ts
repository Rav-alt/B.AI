// Phase 5: the pure helpers behind the route view.
import { describe, expect, it } from "vitest";
import { loadNetwork } from "@/lib/router/network";
import { planTrip } from "@/lib/router/plan";
import { badgeLabel, legendItems, legMeta, optionLabel, optionLead, totalSummary } from "@/lib/ui/route-view";

const net = loadNetwork();
const o = { name: "Pedro Gil Taft", lat: 14.5763, lon: 120.988 };
const d = { name: "UST", lat: 14.60972, lon: 120.98972 };
const plan = planTrip(net, o, d);
const best = plan.itineraries[0]!;

describe("route view helpers", () => {
  it("badges say the mode in words (train → its line)", () => {
    const labels = best.legs.map((l) => badgeLabel(l, "fil"));
    expect(labels).toEqual(["LAKAD", "BUS", "LAKAD"]);
    const train = planTrip(net, { name: "Cubao", lat: 14.6207, lon: 121.0532 }, { name: "Ayala", lat: 14.55124, lon: 121.02537 }, { trainsOnly: true });
    expect(train.itineraries[0]!.legs.map((l) => badgeLabel(l, "fil"))).toContain("MRT-3");
  });

  it("meta lines are compact and mono-friendly", () => {
    expect(legMeta(best.legs[0]!, "fil")).toMatch(/^\d+ m · ~\d+ min$/);
    expect(legMeta(best.legs[1]!, "fil")).toMatch(/^\d+\.\d km · ~\d+ min$/);
    expect(totalSummary(best, "fil")).toMatch(/^~\d+ min · walang transfer · \d+ m lakad$/);
    expect(totalSummary(best, "en")).toMatch(/no transfers · \d+ m walk$/);
  });

  it("other options get a lead and a signboard label", () => {
    const second = plan.itineraries[1]!;
    expect(optionLead(second, 1, "fil")).toMatch(/^Option 2: mga \*\*\d+ min\*\*/);
    expect(optionLabel(best, "fil")).toBe("Baclaran – SM Fairview");
  });

  it("the legend lists each mode once, in order", () => {
    expect(legendItems(best, "fil").map((l) => l.label)).toEqual(["Lakad", "Bus"]);
  });
});
