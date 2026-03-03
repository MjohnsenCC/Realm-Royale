declare module "poisson-disk-sampling" {
  interface PoissonDiskSamplingOptions {
    shape: number[];
    minDistance: number;
    maxDistance?: number;
    tries?: number;
  }

  class PoissonDiskSampling {
    constructor(
      options: PoissonDiskSamplingOptions,
      distanceFunction?: unknown,
      rng?: () => number
    );
    fill(): number[][];
    getAllPoints(): number[][];
    addPoint(point: number[]): number[] | undefined;
    reset(): void;
  }

  export default PoissonDiskSampling;
}
