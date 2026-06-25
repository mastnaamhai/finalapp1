import React from 'react';

interface PageHeaderProps {
    title: string;
    subtitle?: string;
    actions?: React.ReactNode;
}

export const PageHeader: React.FC<PageHeaderProps> = ({ title, subtitle, actions }) => {
    return (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 -mx-4 sm:mx-0 sm:rounded-2xl bg-white/60 backdrop-blur-md border border-white/20 shadow-sm sticky top-[4rem] lg:top-0 z-30 transition-all duration-200 hover:shadow-md hover:bg-white/80">
            <div>
                <h1 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-900 to-indigo-600">
                    {title}
                </h1>
                {subtitle && (
                    <p className="text-sm text-gray-500 mt-1 font-medium">{subtitle}</p>
                )}
            </div>
            {actions && (
                <div className="flex items-center gap-3">
                    {actions}
                </div>
            )}
        </div>
    );
};
