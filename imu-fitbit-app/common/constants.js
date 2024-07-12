// Files in the "common" directory are accessible from both companion (phone) and smartwatch (app)

export const APP_DIRECTORY     = "/private/data/";
export const SAMPLE_FREQUENCY  = 100;
export const SAMPLES_PER_BATCH = 100;
export const BYTES_PER_SAMPLE  = 4;
export const BYTES_PER_BATCH   = SAMPLES_PER_BATCH*BYTES_PER_SAMPLE;
export const AXIS_NAMES        = ["x", "y", "z"];
