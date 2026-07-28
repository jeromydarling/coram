import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { SearchMemoryBanner } from "@/components/discovery/SearchMemoryBanner";

describe("SearchMemoryBanner", () => {
  it("renders nothing when mergedCount is 0", () => {
    const { container } = render(<SearchMemoryBanner mergedCount={0} priorRunsMerged={0} />);
    expect(container.firstChild).toBeNull();
  });

  it("renders banner with correct text when mergedCount > 0", () => {
    const { getByText } = render(<SearchMemoryBanner mergedCount={5} priorRunsMerged={2} />);
    expect(getByText(/enriched from 2 prior searches/i)).toBeInTheDocument();
    expect(getByText(/5 additional results merged/i)).toBeInTheDocument();
  });

  it("uses singular form for 1 prior run", () => {
    const { getByText } = render(<SearchMemoryBanner mergedCount={1} priorRunsMerged={1} />);
    expect(getByText(/1 prior search\b/i)).toBeInTheDocument();
    expect(getByText(/1 additional result merged/i)).toBeInTheDocument();
  });
});
