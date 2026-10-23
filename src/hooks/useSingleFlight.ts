import { useState } from "react";

import { createSingleFlight, type SingleFlight } from "@/utils/singleFlight";

/** A per-component SingleFlight — see `utils/singleFlight.ts` for why. */
export function useSingleFlight(): SingleFlight {
  const [flight] = useState(createSingleFlight);
  return flight;
}
