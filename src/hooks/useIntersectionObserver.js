import { useEffect, useRef, useState } from 'react';

function useIntersectionObserver(options) {
    const [entry, setEntry] = useState(null);
    const observerRef = useRef(null);
    const elementRef = useRef(null);

    useEffect(() => {
        if (elementRef.current) {
            const observer = new IntersectionObserver(([ent]) => {
                setEntry(ent);
            }, options);

            observer.observe(elementRef.current);
            observerRef.current = observer;

            return () => {
                if (observerRef.current) {
                    observerRef.current.disconnect();
                }
            };
        }
    }, [options]);

    return [elementRef, entry];
}

export default useIntersectionObserver;
