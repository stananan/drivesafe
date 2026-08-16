import { ClipsDashboard } from '@/components/clips-dashboard';

/** The driver's own clips. Shared with the parent's tab of the same name. */
export default function ChildClipsScreen() {
  return <ClipsDashboard role="child" />;
}
