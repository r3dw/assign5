import { BikeSketch } from "./BikeSketch";

/**
 * Faint bicycle sketches behind the page. Fixed to the window, behind everything, and
 * ignored by the mouse, so they never get in the way. Low opacity keeps the text on top
 * easy to read.
 */
export function Backdrop() {
  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      <BikeSketch className="absolute -bottom-8 -right-20 w-[34rem] -rotate-6 text-sky opacity-25 dark:opacity-20" />
      <BikeSketch className="absolute left-[-9rem] top-56 hidden w-96 rotate-6 -scale-x-100 text-sky opacity-20 dark:opacity-15 md:block" />
    </div>
  );
}
