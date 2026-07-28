import { FindPage } from '@/components/discovery/FindPage';
import { useLocation } from 'react-router-dom';

export default function FindPeople() {
  const { pathname } = useLocation();
  const isOperatorRoute = pathname.startsWith('/operator');

  return (
    <div data-testid="find-people-root">
      {isOperatorRoute ? (
        <FindPage searchType="people" noLayout />
      ) : (
        <FindPage searchType="people" />
      )}
    </div>
  );
}
