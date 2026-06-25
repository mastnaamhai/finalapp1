import React from 'react';

interface PageContainerProps {
    children: React.ReactNode;
    className?: string;
}

export const PageContainer: React.FC<PageContainerProps> = ({ children, className = '' }) => {
    return (
        <div className={`space-y-6 animate-fade-in ${className}`}>
            {children}
        </div>
    );
};
