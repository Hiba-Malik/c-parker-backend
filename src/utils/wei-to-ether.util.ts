/**
 * Convert wei (smallest unit) to ether (human-readable format)
 * @param weiAmount - Amount in wei (string or number)
 * @returns Amount in ether as string with up to 18 decimal places (no scientific notation)
 */
export function weiToEther(weiAmount: string | number | null | undefined): string | null {
  if (!weiAmount && weiAmount !== 0) return null;
  
  let wei: string;
  
  if (typeof weiAmount === 'number') {
    // If it's a number, check if it's in scientific notation range
    if (Math.abs(weiAmount) < 1e-6 || Math.abs(weiAmount) >= 1e15) {
      // Use toFixed to avoid scientific notation
      wei = weiAmount.toFixed(18);
    } else {
      wei = weiAmount.toString();
    }
  } else {
    wei = weiAmount.trim();
  }
  
  // Handle scientific notation in string
  if (wei.includes('e') || wei.includes('E')) {
    const num = parseFloat(wei);
    if (isNaN(num)) return null;
    // Convert to fixed decimal string to avoid scientific notation
    return num.toFixed(18).replace(/\.?0+$/, '') || '0';
  }
  
  // If already in decimal format (has a decimal point), return as-is but format properly
  if (wei.includes('.')) {
    // Already in ether format, just ensure no scientific notation
    const num = parseFloat(wei);
    if (isNaN(num)) return null;
    
    // Convert to fixed decimal string to avoid scientific notation
    return num.toFixed(18).replace(/\.?0+$/, '') || '0';
  }
  
  // Handle wei amounts (no decimal point)
  try {
    // Remove any decimal point and parse as integer
    const weiStr = wei.split('.')[0];
    const weiBigInt = BigInt(weiStr);
    const divisor = BigInt('1000000000000000000'); // 10^18
    
    const wholePart = weiBigInt / divisor;
    const remainder = weiBigInt % divisor;
    
    // Format remainder with leading zeros to ensure 18 decimal places
    const remainderStr = remainder.toString().padStart(18, '0');
    
    
    return `${wholePart}`;
  } catch (error) {
    // If BigInt conversion fails, try parsing as number
    const num = parseFloat(wei);
    if (isNaN(num)) return null;
    
    // Convert to fixed decimal string to avoid scientific notation
    const ether = num / 1e18;
    return ether.toFixed(18).replace(/\.?0+$/, '') || '0';
  }
}

