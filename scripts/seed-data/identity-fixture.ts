import type { JsonObject } from "@/lib/airwallex/json";

export const SPIKE_COUNTRY = "US";

export type FixtureRole = "seller" | "revenue";

export type IdentityFixture = {
  role: FixtureRole;
  email: string;
  identifier: string;
  nickname: string;
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  nationality: string;
  phoneNumber: string;
  occupation: "PROGRAMMER";
  businessName: string;
  address: {
    addressLine1: string;
    countryCode: string;
    postcode: string;
    state: string;
    suburb: string;
  };
};

// DEMO-ONLY: Fixture identity, with Airwallex terms agreed on the person's behalf.
// PROD: Collect real identity and consent via Hosted Onboarding or Embedded KYC, and handle RFIs.
export const identityFixtures: Record<FixtureRole, IdentityFixture> = {
  seller: {
    role: "seller",
    email: "spike.seller@example.com",
    identifier: "spike-seller",
    nickname: "Spike seller",
    firstName: "Maya",
    lastName: "Spike",
    dateOfBirth: "1990-01-01",
    nationality: SPIKE_COUNTRY,
    phoneNumber: "2025550143",
    occupation: "PROGRAMMER",
    businessName: "Maya Spike Design LLC",
    address: {
      addressLine1: "1 Market Street",
      countryCode: SPIKE_COUNTRY,
      postcode: "94105",
      state: "CA",
      suburb: "San Francisco",
    },
  },
  revenue: {
    role: "revenue",
    email: "spike.revenue@example.com",
    identifier: "spike-revenue",
    nickname: "Spike revenue",
    firstName: "Revenue",
    lastName: "Spike",
    dateOfBirth: "1990-01-01",
    nationality: SPIKE_COUNTRY,
    phoneNumber: "2025550199",
    occupation: "PROGRAMMER",
    businessName: "Platform Revenue",
    address: {
      addressLine1: "1 Market Street",
      countryCode: SPIKE_COUNTRY,
      postcode: "94105",
      state: "CA",
      suburb: "San Francisco",
    },
  },
};

export type AccountPayloadLevel = "minimal" | "identification" | "recipient";

function addressOf(person: IdentityFixture): JsonObject {
  return {
    address_line1: person.address.addressLine1,
    country_code: person.address.countryCode,
    postcode: person.address.postcode,
    state: person.address.state,
    suburb: person.address.suburb,
  };
}

// DEMO-ONLY: a stable fake EIN per account. The spike accepted type EIN; sharing one number across seed users was not tested.
function fixtureEin(identifier: string): string {
  let hash = 0;
  for (const char of identifier) hash = (hash * 33 + char.charCodeAt(0)) % 1_000_000_000;
  return String(hash).padStart(9, "0");
}

function director(person: IdentityFixture): JsonObject {
  return {
    first_name: person.firstName,
    last_name: person.lastName,
    date_of_birth: person.dateOfBirth,
    nationality: person.nationality,
    roles: ["DIRECTOR"],
    residential_address: addressOf(person),
    identifications: {
      primary: {
        identification_type: "PASSPORT",
        issuing_country_code: person.nationality,
        passport: {
          number: "X00000000",
          effective_at: "2020-01-01",
          expire_at: "2030-01-01",
        },
      },
    },
  };
}

/**
 * Body for POST /api/v1/accounts/create and /update.
 * BUSINESS is required: this sandbox rejects Funds Splits to individual accounts.
 * `level` is retained for the spike's attempt log; every level is this same payload.
 * Submit rejected the account until `business_person_details[0].identifications.primary` was set.
 * Do not set `service_agreement_type: RECIPIENT`. The working account defaulted to FULL.
 */
export function accountCreateBody(person: IdentityFixture, level: AccountPayloadLevel = "identification"): JsonObject {
  return {
    identifier: person.identifier,
    nickname: person.nickname,
    metadata: { role: person.role, payloadLevel: level },
    primary_contact: { email: person.email },
    customer_agreements: {
      agreed_to_data_usage: true,
      agreed_to_terms_and_conditions: true,
    },
    account_details: {
      legal_entity_type: "BUSINESS",
      business_details: {
        business_name: person.businessName,
        business_structure: "COMPANY",
        url: "https://example.com",
        industry_category_code: "ICCV3_0802XX",
        description_of_goods_or_services: "Freelance marketplace services",
        operating_country: [SPIKE_COUNTRY],
        business_identifiers: [{ country_code: SPIKE_COUNTRY, number: fixtureEin(person.identifier), type: "EIN" }],
        account_usage: {
          product_reference: ["RECEIVE_TRANSFERS"],
          estimated_monthly_revenue: { amount: "5000", currency: "USD" },
        },
        business_address: addressOf(person),
        registration_address: addressOf(person),
      },
      business_person_details: [director(person)],
    },
  };
}
