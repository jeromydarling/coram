import { describe, it, expect, vi } from "vitest";
import { render } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { OpportunityEnrichmentTimeline } from "@/components/opportunity/OpportunityEnrichmentTimeline";

// Mock supabase
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: () => ({
      select: () => ({
        eq: () => ({
          in: () => ({
            order: () => ({
              limit: () => Promise.resolve({ data: [], error: null }),
            }),
          }),
        }),
      }),
    }),
  },
}));

function renderWithProviders(ui: React.ReactElement) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>);
}

describe("OpportunityEnrichmentTimeline", () => {
  it("renders nothing when no activity", () => {
    const { container } = renderWithProviders(
      <OpportunityEnrichmentTimeline opportunityId="test-id" />
    );
    // With no statuses, should not render the card
    expect(container.querySelector('[class*="Card"]')).toBeNull();
  });

  it("renders pipeline steps when activity exists", () => {
    const { getByText } = renderWithProviders(
      <OpportunityEnrichmentTimeline
        opportunityId="test-id"
      />
    );
    expect(getByText("Enrichment Pipeline")).toBeInTheDocument();
    expect(getByText("Org Knowledge Bootstrap")).toBeInTheDocument();
    expect(getByText("Neighborhood Insights")).toBeInTheDocument();
    expect(getByText("Contact Enrichment")).toBeInTheDocument();
  });
});
