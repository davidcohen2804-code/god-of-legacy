import { CURRENT_STAGE, VERSION } from '../config/layout';

export const BuildInfo = {
  version: VERSION.text,
  builtAt: __BUILD_TIME__,
  commit: __BUILD_COMMIT__,
  stage: CURRENT_STAGE,
} as const;
