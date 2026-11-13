/** Bounds asynchronous loading, clearing timers on both success and failure. */
export function withTimeout<T>(operation: Promise<T>, milliseconds: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("Preview loading timed out")), milliseconds);
    operation.then((value) => { clearTimeout(timer); resolve(value); }, (error: unknown) => { clearTimeout(timer); reject(error); });
  });
}
