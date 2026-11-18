import * as pdfBundle from "./vendor/pdf-lib-1.17.1.min.js";

const { PDFDocument, StandardFonts, rgb } = globalThis.PDFLib || pdfBundle.default;
const PAGE_WIDTH = 792;
const PAGE_HEIGHT = 612;
const MARGIN = 32;
const WIDTH = PAGE_WIDTH - 2 * MARGIN;
const COLUMN = WIDTH / 5;

function color(hex) {
  const channels = hex.slice(1).match(/../g).map((value) => parseInt(value, 16) / 255);
  return rgb(...channels);
}

function wrap(text, font, size, width) {
  // Helvetica uses WinAnsi. Preserve supported punctuation and transliterate
  // text that a PDF viewer otherwise could not render in this font.
  const printable = Array.from(text, (char) => {
    try {
      font.encodeText(char);
      return char;
    } catch {
      return char.normalize("NFKD").replace(/[^\x20-\x7e]/g, "") || "?";
    }
  }).join("");
  const words = printable.trim().split(/\s+/);
  const lines = [];
  let line = "";
  for (const word of words) {
    const joined = line ? line + " " + word : word;
    if (font.widthOfTextAtSize(joined, size) <= width) {
      line = joined;
      continue;
    }
    if (line) lines.push(line);
    line = "";
    for (const char of word) {
      if (line && font.widthOfTextAtSize(line + char, size) > width) {
        lines.push(line);
        line = "";
      }
      line += char;
    }
  }
  if (line) lines.push(line);
  return lines;
}

function prepareMeal(days, meal, groups, shareAcrossSomeDays = false) {
  const station = (day, key) => day[meal]?.[key] || [];
  const menuDays = days.filter((day) => groups.some(([key]) => station(day, key).length));
  const shared = new Map();
  const notes = [];
  for (const [key, label, share] of groups) {
    if ((!share && (!shareAcrossSomeDays || !["fruit", "vegetable"].includes(key))) || menuDays.length < 2) continue;
    const names = new Set(menuDays.flatMap((day) => station(day, key)));
    const byDays = new Map();
    const repeated = new Set();
    for (const name of names) {
      const served = menuDays.filter((day) => station(day, key).includes(name));
      if (served.length !== menuDays.length && (!shareAcrossSomeDays || served.length < 3)) continue;
      const schedule = served.length === menuDays.length ? ""
        : served.map((day) => day.weekday.slice(0, 3)).join(", ") + ": ";
      if (!byDays.has(schedule)) byDays.set(schedule, []);
      byDays.get(schedule).push(name);
      repeated.add(name);
    }
    if (repeated.size) shared.set(key, repeated);
    for (const [schedule, foods] of byDays) notes.push({label, names: foods, schedule});
  }
  const columns = days.map((day) => {
    if (!menuDays.includes(day)) return [{ name: "No menu posted", bold: false, gap: false }];
    const lines = [];
    for (const [key, label, share] of groups) {
      const names = station(day, key).filter((name) => !shared.get(key)?.has(name));
      names.forEach((name, index) => {
        const isFirst = lines.length > 0 && index === 0;
        lines.push({
          name: share && index === 0 ? label + ": " + name : name,
          group: key,
          bold: key === "entree",
          gap: isFirst
        });
      });
    }
    return lines;
  });
  return { title: meal === "breakfast" ? "Breakfast" : "Lunch", columns, shared: notes };
}

function mealLayout(meal, fonts, size, maxColumnLines = Infinity) {
  const compact = size < 9.5;
  const leading = size * (compact ? 1.12 : 1.2);
  const columns = meal.columns.map((column) => {
    const entries = compact ? column.reduce((items, item) => {
      const last = items[items.length - 1];
      if (!item.bold && last && last.group === item.group) last.name += " / " + item.name;
      else items.push({ ...item });
      return items;
    }, []) : column;
    const lines = entries.flatMap(({name, bold, gap}) =>
      wrap(name, bold ? fonts.bold : fonts.regular, size, COLUMN - 20)
        .map((text, index, itemLines) => ({
          text, bold, before: gap && index === 0 ? (compact ? 2 : 4) : 0,
          after: index === itemLines.length - 1 ? (compact ? 0.5 : 2) : 0
        })));
    if (lines.length > maxColumnLines) {
      return lines.slice(0, maxColumnLines - 1)
        .concat({text: "More options in app", bold: false, before: 4, after: 0});
    }
    return lines;
  });
  const notes = meal.shared.map(({label, names, schedule}) => ({
    label,
    lines: wrap(schedule + names.join("  /  "), fonts.regular, size - 0.8, WIDTH - 114)
  }));
  const columnHeight = Math.max(...columns.map((column) =>
    column.reduce((total, line) => total + leading + line.before + line.after, 0)));
  const notesHeight = notes.length
    ? 12 + notes.reduce((total, note) => total + note.lines.length * leading + 3, 0)
    : 0;
  return { ...meal, columns, notes, size, leading, columnHeight, notesHeight,
    height: 24 + 18 + columnHeight + notesHeight };
}

export async function createWeeklyMenuPdf({school, weekText, days, primary, secondary, preview}) {
  const pdf = await PDFDocument.create();
  pdf.setTitle(school + " - " + weekText);
  const fonts = {
    regular: await pdf.embedFont(StandardFonts.Helvetica),
    bold: await pdf.embedFont(StandardFonts.HelveticaBold)
  };
  const page = pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  const context = preview?.getContext("2d");
  if (context) {
    preview.width = PAGE_WIDTH * 2;
    preview.height = PAGE_HEIGHT * 2;
    context.scale(2, 2);
  }
  rect(0, 0, PAGE_WIDTH, PAGE_HEIGHT, rgb(1, 1, 1));
  const ink = color("#201b2c");
  const muted = color("#514b60");
  const line = color("#ccc7d4");
  const accent = color(primary);
  const stripe = color(secondary);
  const wash = rgb(0.92 + 0.08 * accent.red, 0.92 + 0.08 * accent.green, 0.92 + 0.08 * accent.blue);

  const breakfastGroups = [
    ["entree", "Entrée", false], ["fruit", "Fruit", false],
    ["daily_serve", "Daily cereal", true], ["milk", "Breakfast milk", true]
  ];
  const lunchGroups = [
    ["entree", "Entrée", false], ["vegetable", "Vegetables", false], ["fruit", "Fruit", false],
    ["daily_serve", "Daily option", true], ["express", "Express", true], ["milk", "Lunch milk", true]
  ];
  let meals = [prepareMeal(days, "breakfast", breakfastGroups), prepareMeal(days, "lunch", lunchGroups)];
  const available = 416;
  const combinedHeight = (layouts) => layouts.reduce((sum, item) => sum + item.height, 0);
  let size = 10.5;
  let layouts = meals.map((meal) => mealLayout(meal, fonts, size));
  while (combinedHeight(layouts) > available && size > 8.5) {
    size -= 0.5;
    layouts = meals.map((meal) => mealLayout(meal, fonts, size));
  }
  if (combinedHeight(layouts) > available) {
    meals = [prepareMeal(days, "breakfast", breakfastGroups, true), prepareMeal(days, "lunch", lunchGroups, true)];
    layouts = meals.map((meal) => mealLayout(meal, fonts, size));
    let maxLines = Math.max(...layouts.flatMap((layout) => layout.columns.map((column) => column.length)));
    while (combinedHeight(layouts) > available && maxLines > 2) {
      maxLines--;
      layouts = meals.map((meal) => mealLayout(meal, fonts, size, maxLines));
    }
  }

  function cssColor(value) {
    return "rgb(" + [value.red, value.green, value.blue].map((channel) => Math.round(channel * 255)).join(",") + ")";
  }

  function rect(x, y, width, height, colorValue) {
    page.drawRectangle({x, y, width, height, color: colorValue});
    if (context) {
      context.fillStyle = cssColor(colorValue);
      context.fillRect(x, PAGE_HEIGHT - y - height, width, height);
    }
  }

  function text(value, x, y, fontSize, colorValue = ink, bold = false) {
    page.drawText(value, {x, y, size: fontSize, color: colorValue, font: bold ? fonts.bold : fonts.regular});
    if (context) {
      context.font = (bold ? "bold " : "") + fontSize + "px Helvetica, Arial, sans-serif";
      context.fillStyle = cssColor(colorValue);
      context.fillText(value, x, PAGE_HEIGHT - y);
    }
  }

  function fitHeader(value, x, y, fontSize, colorValue, bold) {
    const font = bold ? fonts.bold : fonts.regular;
    while (wrap(value, font, fontSize, WIDTH - 110).length > 1 && fontSize > 15) fontSize--;
    text(wrap(value, font, fontSize, WIDTH - 110)[0], x, y, fontSize, colorValue, bold);
  }

  function rule(x1, y1, x2, y2, colorValue = line, thickness = 0.55) {
    page.drawLine({start: {x: x1, y: y1}, end: {x: x2, y: y2}, color: colorValue, thickness});
    if (context) {
      context.strokeStyle = cssColor(colorValue);
      context.lineWidth = thickness;
      context.beginPath();
      context.moveTo(x1, PAGE_HEIGHT - y1);
      context.lineTo(x2, PAGE_HEIGHT - y2);
      context.stroke();
    }
  }

  function drawMeal(layout, top, extraSpace) {
    const bottom = top - layout.height - extraSpace;
    const noteTop = bottom + layout.notesHeight;
    rect(MARGIN, top - 24, WIDTH, 24, wash);
    rect(MARGIN, top - 24, 3, 24, stripe);
    text(layout.title, MARGIN + 11, top - 16.5, 12, accent, true);
    layout.columns.forEach((column, index) => {
      const x = MARGIN + index * COLUMN;
      if (index) rule(x, top - 24, x, noteTop);
      let y = top - 35 - layout.size;
      for (const item of column) {
        y -= item.before;
        text(item.text, x + 10, y, layout.size, item.bold ? ink : muted, item.bold);
        y -= layout.leading + item.after;
      }
    });
    if (layout.notes.length) {
      rule(MARGIN, noteTop, PAGE_WIDTH - MARGIN, noteTop);
      let y = noteTop - 13.5;
      for (const note of layout.notes) {
        text(note.label, MARGIN + 10, y, layout.size - 2, accent, true);
        for (const line of note.lines) {
          text(line, MARGIN + 102, y, layout.size - 0.8);
          y -= layout.leading;
        }
        y -= 3;
      }
    }
    rule(MARGIN, bottom, PAGE_WIDTH - MARGIN, bottom);
    return bottom;
  }

  fitHeader(school, MARGIN, 566, 25, ink, true);
  text(weekText, MARGIN, 544, 13, muted);
  text("WEEKLY MENU", PAGE_WIDTH - MARGIN - fonts.bold.widthOfTextAtSize("WEEKLY MENU", 9), 550, 9, accent, true);
  rule(MARGIN, 529, PAGE_WIDTH - MARGIN, 529, accent, 0.95);
  days.forEach((day, index) => {
    const x = MARGIN + index * COLUMN + 10;
    text(day.weekday, x, 510, 11.6, ink, true);
    text(day.shortDate, x, 494, 9.5, muted);
  });

  const spare = Math.max(0, available - combinedHeight(layouts));
  const breakfastBottom = drawMeal(layouts[0], 481, spare * 0.4);
  drawMeal(layouts[1], breakfastBottom - 13, spare * 0.6);
  text("West Shore School District menus via Nutrislice", MARGIN, 34, 8.1, muted);
  const footnote = "Condiments omitted  /  Menus may change";
  text(footnote, PAGE_WIDTH - MARGIN - fonts.regular.widthOfTextAtSize(footnote, 8.1), 34, 8.1, muted);
  return pdf.save();
}
