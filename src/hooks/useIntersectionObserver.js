import { useRef, useEffect, useState } from 'react';

const useIntersectionObserver = (options) => {
    const ref = useRef(null);
    const [entry, setEntry] = useState(null);

    useEffect(() => {
        const observer = new IntersectionObserver(([ent]) => {
            setEntry(ent);
        }, {
            // Đặt rootMargin mặc định là '0px' để chỉ kích hoạt khi phần tử thực sự vào viewport
            // threshold mặc định là 0 để kích hoạt ngay khi 1 pixel của phần tử xuất hiện
            root: options?.root || null,
            rootMargin: options?.rootMargin || '0px',
            threshold: options?.threshold || 0,
        });

        if (ref.current) {
            observer.observe(ref.current);
        }

        return () => {
            if (ref.current) {
                observer.unobserve(ref.current);
            }
        };
    }, [options]);

    return [ref, entry];
};

export default useIntersectionObserver;
