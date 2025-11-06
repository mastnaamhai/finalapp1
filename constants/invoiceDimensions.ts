// Invoice dimensions configuration
// A4 landscape: 297mm × 210mm
// A3 landscape: 420mm × 297mm
// Custom: Set to desired width (e.g., 500mm, 550mm, 600mm)

/**
 * Invoice width - expanded canvas for on-screen layout; printing will scale to A4
 * 500mm provides a wider working area while print styles fit to A4
 */
export const INVOICE_WIDTH = '500mm';

/**
 * Invoice height - set to full A4 page height in landscape
 * 210mm corresponds to A4 landscape height
 */
export const INVOICE_HEIGHT = '210mm';

/**
 * Calculate approximate pixel width at 96 DPI
 * Used for preview calculations
 */
export const getInvoiceWidthPx = (): number => {
  // Convert mm to pixels at 96 DPI
  // 1mm = 3.779527559 pixels at 96 DPI
  const widthMm = parseFloat(INVOICE_WIDTH.replace('mm', ''));
  return Math.round(widthMm * 3.779527559);
};
