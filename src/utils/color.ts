/** 内部用：仅解析为 RGB，不包含透明度。对外统一用 parseColorWithOpacity 以保留透明度。 */
function parseRgbOnly(color: string): RGB {
  const hex = color.trim();
  if (hex.startsWith('rgb')) {
    return parseRgbString(hex);
  }
  return hexToRgb(hex);
}

function hexToRgb(hex: string): RGB {
  let h = hex.replace('#', '');

  if (h.length === 3) {
    h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
  }

  const num = parseInt(h.substring(0, 6), 16);
  return {
    r: ((num >> 16) & 255) / 255,
    g: ((num >> 8) & 255) / 255,
    b: (num & 255) / 255,
  };
}

function parseRgbString(str: string): RGB {
  const nums = str.match(/[\d.]+/g);
  if (!nums || nums.length < 3) {
    return { r: 0, g: 0, b: 0 };
  }
  return {
    r: parseFloat(nums[0]) / 255,
    g: parseFloat(nums[1]) / 255,
    b: parseFloat(nums[2]) / 255,
  };
}

export function parseColorWithOpacity(color: string): { color: RGB; opacity: number } {
  const hex = color.trim();

  if (hex.startsWith('rgba')) {
    const nums = hex.match(/[\d.]+/g);
    if (nums && nums.length >= 4) {
      return {
        color: {
          r: parseFloat(nums[0]) / 255,
          g: parseFloat(nums[1]) / 255,
          b: parseFloat(nums[2]) / 255,
        },
        opacity: parseFloat(nums[3]),
      };
    }
  }

  let h = hex.replace('#', '');
  if (h.length === 8) {
    const alpha = parseInt(h.substring(6, 8), 16) / 255;
    return {
      color: hexToRgb('#' + h.substring(0, 6)),
      opacity: alpha,
    };
  }

  // CSS 变量或其他无法解析的字符串 → 返回透明色，而不是黑色
  if (hex.startsWith('var(') || hex.indexOf('var(') >= 0) {
    return { color: { r: 0, g: 0, b: 0 }, opacity: 0 };
  }

  return { color: parseRgbOnly(hex), opacity: 1 };
}