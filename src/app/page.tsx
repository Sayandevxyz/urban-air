import { UrbanAirWorkbench } from "@/components/UrbanAirWorkbench";
import { getEnv } from "@/lib/env";

/**
 * Server entry page reading validated configuration and rendering the air quality workbench.
 */
export default function HomePage() {
  const env = getEnv();
  const defaultDemoMode = env.NEXT_PUBLIC_DEFAULT_DEMO_MODE === "true";

  return <UrbanAirWorkbench defaultDemoMode={defaultDemoMode} />;
}
