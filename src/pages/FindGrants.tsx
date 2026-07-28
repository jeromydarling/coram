import { FindPage } from '@/components/discovery/FindPage';

export default function FindGrants() {
  return (
    <div data-testid="find-grants-root" data-tour="find-grants-search">
      <FindPage searchType="grant" />
    </div>
  );
}
