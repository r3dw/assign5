/** The parts of a trip that decide which station is the pick-up and which is the drop-off. */
export type TripLike = {
  originId: string;
  destinationId: string | null;
  origin: string;
  destination: string | null;
};

export type Oriented = {
  pickupId: string;
  pickup: string;
  dropoffId: string | null;
  dropoff: string | null;
  /** true only when the trip is shown as its return leg */
  reversed: boolean;
};

/**
 * Which way to show a trip. A saved trip is one row (origin, destination); the return leg
 * is the same two stations with the roles swapped, so it never has to be saved again.
 * A trip with no destination has no return leg and is always shown as saved.
 */
export function orient(trip: TripLike, reversed: boolean): Oriented {
  if (reversed && trip.destinationId && trip.destination) {
    return {
      pickupId: trip.destinationId,
      pickup: trip.destination,
      dropoffId: trip.originId,
      dropoff: trip.origin,
      reversed: true,
    };
  }
  return {
    pickupId: trip.originId,
    pickup: trip.origin,
    dropoffId: trip.destinationId,
    dropoff: trip.destination,
    reversed: false,
  };
}
