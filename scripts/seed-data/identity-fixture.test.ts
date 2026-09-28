import { describe, expect, it } from "vitest";
import { accountCreateBody, identityFixtures } from "./identity-fixture";

describe("accountCreateBody", () => {
  it("creates a business account that can receive a Funds Split", () => {
    const body = accountCreateBody(identityFixtures.seller);
    const details = body.account_details as {
      legal_entity_type: string;
      business_details: Record<string, unknown>;
      business_person_details: Array<Record<string, unknown>>;
    };
    expect(details.legal_entity_type).toBe("BUSINESS");
    expect(details.business_details).toMatchObject({
      business_name: "Maya Spike Design LLC",
      business_structure: "COMPANY",
      industry_category_code: "ICCV3_0802XX",
    });
    expect(details.business_person_details[0]).toMatchObject({
      first_name: "Maya",
      last_name: "Spike",
      roles: ["DIRECTOR"],
    });
    expect(details.business_person_details[0]).toHaveProperty("identifications");
    expect(body.customer_agreements).toMatchObject({
      agreed_to_data_usage: true,
      agreed_to_terms_and_conditions: true,
    });
    expect(body.customer_agreements).not.toHaveProperty("terms_and_conditions");
    const sellerEin = (details.business_details.business_identifiers as Array<{ number: string }>)[0]?.number;
    const revenueBody = accountCreateBody(identityFixtures.revenue);
    const revenueDetails = revenueBody.account_details as {
      business_details: { business_identifiers: Array<{ number: string }> };
    };
    expect(sellerEin).toMatch(/^\d{9}$/);
    expect(revenueDetails.business_details.business_identifiers[0]?.number).not.toBe(sellerEin);
  });

  it("uses the fee account name for the revenue fixture", () => {
    const body = accountCreateBody(identityFixtures.revenue, "recipient");
    const details = body.account_details as { business_details: { business_name: string } };
    expect(details.business_details.business_name).toBe("Platform Revenue");
  });
});
