import { useEffect, useState } from 'react';
import { calculateMaturity } from '../services/api';

export function useCalculateMaturity(
    depositAmount: string,
    schemeCode: string,
    months: string,
    days: string,
) {
    const [maturityData, setMaturityData] = useState<any>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        console.log('useCalculateMaturity triggered');

        if (!depositAmount || !schemeCode) {
            setMaturityData(null);
            return;
        }

        console.log('Calling API with:', {
            depositAmount,
            schemeCode,
            months,
            days,
        });


        let cancelled = false;

        setLoading(true);
        setError('');

        calculateMaturity(
            Number(depositAmount),
            schemeCode,
            Number(months),
            Number(days),
        )
            .then((res) => {
                console.log('API Response in Hook:', res);

                if (!cancelled) {
                    setMaturityData(res);
                }
            })
            .catch((err) => {
                console.error('Maturity Error:', err);

                if (!cancelled) {
                    setError(
                        err instanceof Error
                            ? err.message
                            : 'Unable to calculate maturity'
                    );
                }
            })
            .finally(() => {
                if (!cancelled) {
                    setLoading(false);
                }
            });

        return () => {
            cancelled = true;
        };
    }, [depositAmount, schemeCode, months, days]);

    return {
        maturityData,
        loading,
        error,
    };
}