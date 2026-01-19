import React, { useState } from 'react';
import type { TruckHiringNote, CompanyInfo } from '../types';
import { generateDocumentPdf, printDocument } from '../services/pdfService';
import { PDFViewer, usePDFViewer } from './ui/PDFViewer';
import { PDFActionBar } from './ui/PDFActionBar';
import { formatDate, numberToWords } from '../services/utils';

interface THNPdfProps {
    thn: TruckHiringNote;
    companyInfo: CompanyInfo;
    onBack: () => void;
}

export const THNPdf: React.FC<THNPdfProps> = ({ thn, companyInfo, onBack }) => {
    const [isGenerating, setIsGenerating] = useState(false);
    const [isPrinting, setIsPrinting] = useState(false);
    const { openViewer, PDFViewerComponent } = usePDFViewer();

    const handleGeneratePdf = async () => {
        setIsGenerating(true);
        try {
            await generateDocumentPdf(
                'thn-pdf-container', 
                'truck-hiring-note', 
                thn.thnNumber,
                thn.date
            );
        } catch (error) {
            console.error('PDF generation failed:', error);
            alert('Failed to generate PDF. Please try again.');
        } finally {
            setIsGenerating(false);
        }
    };

    const handlePrint = async () => {
        setIsPrinting(true);
        try {
            await printDocument('thn-pdf-container', {
                orientation: 'portrait',
                scale: 'fit',
                margins: 'minimum'
            });
        } catch (error) {
            console.error('Print failed:', error);
            alert('Failed to print. Please try again.');
        } finally {
            setIsPrinting(false);
        }
    };

    const handleViewPdf = async () => {
        try {
            const printWindow = window.open('', '_blank', 'width=800,height=600');
            if (printWindow) {
                const element = document.getElementById('thn-pdf-container');
                if (element) {
                    const clonedElement = element.cloneNode(true) as HTMLElement;
                    printWindow.document.write(`
                        <!DOCTYPE html>
                        <html>
                            <head>
                                <title>Truck Hiring Note ${thn.thnNumber}</title>
                                <style>
                                    body { margin: 0; padding: 20px; font-family: 'Times New Roman', serif; }
                                    @page { size: A4 portrait; margin: 0.5in; }
                                    /* Ensure styles passed from component are applied */
                                    ${Array.from(document.styleSheets)
                                        .map(styleSheet => {
                                            try {
                                                return Array.from(styleSheet.cssRules)
                                                    .map(rule => rule.cssText)
                                                    .join('');
                                            } catch (e) {
                                                return '';
                                            }
                                        })
                                        .join('')}
                                </style>
                            </head>
                            <body>
                                ${clonedElement.outerHTML}
                            </body>
                        </html>
                    `);
                    printWindow.document.close();
                }
            }
        } catch (error) {
            console.error('PDF view failed:', error);
            alert('Failed to open PDF viewer. Please try downloading instead.');
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center no-print print-controls">
                <h2 className="text-3xl font-bold text-gray-800">Truck Hiring Note #{thn.thnNumber}</h2>
                <PDFActionBar
                    fileName={`THN-${thn.thnNumber}`}
                    onView={handleViewPdf}
                    onPrint={handlePrint}
                    onDownload={handleGeneratePdf}
                    onBack={onBack}
                    isGenerating={isGenerating}
                    isPrinting={isPrinting}
                />
            </div>

            <div id="thn-pdf-container" className="print-container">
                <div id="thn-pdf" className="thn-pdf bg-white" style={{
                    width: '210mm',
                    minHeight: '297mm',
                    padding: '20px',
                    margin: '0 auto',
                    backgroundColor: 'white',
                    fontFamily: '"Times New Roman", Times, serif',
                    fontSize: '18px',
                    color: '#000',
                    lineHeight: '1.5'
                }}>
                    <style>{`
                        .thn-pdf * {
                            box-sizing: border-box;
                        }
                        .thn-pdf .header {
                            text-align: center;
                            margin-bottom: 20px;
                            position: relative;
                        }
                        .thn-pdf .logo {
                            position: absolute;
                            left: 10px;
                            top: 0;
                            width: 60px;
                            height: auto;
                        }
                        .thn-pdf .jai-notes {
                            font-size: 16px;
                            text-align: center;
                            color: #666;
                            margin-bottom: 5px;
                        }
                        .thn-pdf .company-name {
                            color: #dc2626; /* Red color from image */
                            font-size: 32px;
                            font-weight: bold;
                            text-transform: uppercase;
                            margin: 5px 0;
                            font-family: Arial, sans-serif;
                            text-align: center;
                        }
                        .thn-pdf .sub-header {
                            font-size: 18px;
                            font-weight: bold;
                            color: #1f2937;
                            text-transform: uppercase;
                            margin-bottom: 5px;
                            text-align: center;
                        }
                        .thn-pdf .address {
                            font-size: 16px;
                            color: #374151;
                            margin-bottom: 2px;
                            text-align: center;
                        }
                        .thn-pdf .email {
                            font-size: 16px;
                            font-weight: bold;
                            color: #374151;
                            text-align: center;
                        }
                        .thn-pdf .contact-box {
                            position: absolute;
                            right: 0;
                            top: 0;
                            text-align: right;
                            font-size: 16px;
                            font-weight: bold;
                        }
                        .thn-pdf .advance-memo-box {
                            border: 2px solid #374151;
                            border-radius: 20px;
                            padding: 2px 10px;
                            font-weight: bold;
                            display: inline-block;
                            margin: 5px 0;
                            font-size: 16px;
                        }
                        .thn-pdf .meta-row {
                            display: flex;
                            justify-content: space-between;
                            margin: 15px 0;
                            font-weight: bold;
                            font-size: 18px;
                            color: #dc2626;
                            align-items: center;
                        }
                        .thn-pdf .meta-row .label {
                            color: #dc2626;
                        }
                        .thn-pdf .meta-row .value {
                            color: #000;
                            margin-left: 5px;
                        }
                        .thn-pdf .content-body {
                            margin-top: 20px;
                            line-height: 1.8;
                        }
                        .thn-pdf .field-line {
                            display: inline-block;
                            min-width: 50px;
                            padding: 0 5px;
                            font-weight: bold;
                            color: #000;
                        }
                         .thn-pdf .field-line-long {
                            display: inline-block;
                            width: 100%;
                            padding: 0 5px;
                            font-weight: bold;
                            color: #000;
                        }
                        .thn-pdf .row {
                            display: flex;
                            align-items: baseline;
                            margin-bottom: 12px;
                            flex-wrap: wrap;
                        }
                        .thn-pdf .row-spaced {
                            display: flex;
                            justify-content: space-between;
                            align-items: baseline;
                            margin-bottom: 12px;
                        }
                         .thn-pdf .flex-1 {
                            flex: 1;
                        }
                        .thn-pdf .label {
                            margin-right: 5px;
                            white-space: nowrap;
                            font-weight: bold;
                        }
                        .thn-pdf .footer {
                            margin-top: 40px;
                            display: flex;
                            justify-content: space-between;
                            align-items: flex-end;
                        }
                        .thn-pdf .bank-box {
                            border: 1px solid #000;
                            padding: 10px;
                            width: 55%;
                            font-size: 14px;
                        }
                        .thn-pdf .signature-box {
                            text-align: right;
                            width: 40%;
                        }
                        .thn-pdf .signature-title {
                            color: #dc2626;
                            font-weight: bold;
                            font-size: 14px;
                            margin-bottom: 40px;
                        }
                        .thn-pdf .bottom-disclaimer {
                            margin-top: 20px;
                            font-size: 16px;
                            text-align: center;
                            border-top: 1px solid #000;
                            padding-top: 5px;
                            font-weight: bold;
                        }
                        
                        @media print {
                            body { margin: 0; padding: 0; }
                            .thn-pdf {
                                width: 100% !important;
                                padding: 20px !important;
                                border: none !important;
                                margin: 0 !important;
                                box-shadow: none !important;
                            }
                            .no-print { display: none !important; }
                        }
                    `}</style>

                    {/* Header */}
                    <div className="header">
                        <div className="contact-box">
                            <div>Mob.: {companyInfo?.phone1}</div>
                            {companyInfo?.phone2 && <div>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;{companyInfo.phone2}</div>}
                        </div>
                        
                        <div className="jai-notes">
                            !! Jai Bajrang Bali !!<br/>
                            !! Jai Dada Nath !!
                        </div>
                        
                        <div className="advance-memo-box">TRUCK HIRE</div>
                        
                        <div className="company-name">{companyInfo?.name}</div>
                        <div className="sub-header">Transport Contractors & Commission Agents</div>
                        <div className="address">{companyInfo?.address}</div>
                        <div className="email">E-mail: {companyInfo?.email}</div>
                    </div>

                    <div style={{ borderBottom: '2px solid #000', margin: '10px 0' }}></div>

                    {/* Meta Info */}
                    <div className="meta-row">
                        <div>
                            <span className="label">No.</span>
                            <span className="value" style={{ fontSize: '24px' }}>{thn.thnNumber}</span>
                        </div>
                        <div>
                            <span className="label">Date :</span>
                            <span className="value">{formatDate(thn.date)}</span>
                        </div>
                    </div>

                    {/* Main Content */}
                    <div className="content-body">
                        {/* Broker Name Line */}
                        <div className="row">
                            <span className="label">Broker's Name:</span>
                            <div style={{ flex: 1, fontWeight: 'bold' }}>
                                &nbsp;{thn.agencyName}
                            </div>
                        </div>


                        <div className="row">
                            <span className="label">Truck No.</span>
                            <span className="field-line" style={{ minWidth: '150px', textAlign: 'center' }}>{thn.truckNumber}</span>
                        </div>

                        {/* Details Grid */}
                        <div style={{ marginTop: '20px' }}>
                            <div className="row">
                                <span className="label">From :</span>
                                <span className="field-line" style={{ flex: 1 }}>{thn.loadingLocation}</span>
                                <span className="label" style={{ margin: '0 10px' }}>To :</span>
                                <span className="field-line" style={{ flex: 1 }}>{thn.unloadingLocation}</span>
                            </div>

                            <div className="row">
                                <span className="label">Loading Point :</span>
                                <span className="field-line" style={{ flex: 1 }}>{thn.loadingLocation}</span>
                            </div>

                            {/* Row: Total Hire & Weight */}
                            <div className="row-spaced">
                                <div style={{ display: 'flex', alignItems: 'baseline', flex: 1 }}>
                                    <span className="label">Total Truck Hire.</span>
                                    <span className="field-line" style={{ flex: 1 }}>{thn.advanceAmount}rs</span>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'baseline', marginLeft: '20px', minWidth: '200px' }}>
                                    <span className="label">Weight :</span>
                                    <span className="field-line" style={{ flex: 1 }}>{thn.vehicleCapacity} {thn.weightUnit || 'Tons'}</span>
                                </div>
                            </div>

                            {/* Row: Dates */}
                            <div className="row-spaced" style={{ marginTop: '20px' }}>
                                <div style={{ display: 'flex', alignItems: 'baseline' }}>
                                    <span className="label">Unloading Date :</span>
                                    <span className="field-line" style={{ minWidth: '150px' }}>
                                        {thn.expectedDeliveryDate ? formatDate(thn.expectedDeliveryDate) : ''}
                                    </span>
                                </div> 
                                <div style={{ display: 'flex', alignItems: 'baseline' }}>
                                    <span className="label">POD Date :</span>
                                    <span style={{ borderBottom: '1px dotted #000', minWidth: '150px', display: 'inline-block' }}>&nbsp;</span>
                                </div>
                            </div>

                        </div>
                    </div>

                    <div className="bottom-disclaimer">
                        We are not responsible for leakage, breakage, fire, theft or damages, and natural calamities due to.<br/>
                        Specialist In : 20ft, 32ft SXL, MXL, HQ 7 MT, 9MT, 15MT, 18 MT, 21MT, 25MT for All Over India
                    </div>

                </div>
            </div>
            <PDFViewerComponent />
        </div>
    );
};
