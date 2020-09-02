import hbs from "hbs";
import fs from "fs";

const blocks = {};

export default function configureHandlebars() {
  // Register Helpers
  hbs.registerHelper("extend", function (name, context) {
    var block = blocks[name];
    if (!block) {
      block = blocks[name] = [];
    }

    block.push(context.fn(this));
  });

  hbs.registerHelper("block", function (name) {
    const val = (blocks[name] || []).join("\n");
    // clear the block
    blocks[name] = [];
    return val;
  });

  hbs.registerHelper("select", function (selected, options) {
    return options
      .fn(this)
      .replace(
        new RegExp(' value="' + selected + '"'),
        '$& selected="selected"'
      );
  });

  hbs.registerHelper("getProperty", function (attribute, context) {
    return context[attribute];
  });

  hbs.registerHelper("serialize", function (context) {
    return new Buffer(JSON.stringify(context)).toString("base64");
  });

  // Given a string like "(703) 555-1212" it generates an anchor tag like so:
  //
  //   <a href="tel:7035551212" aria-label="7 0 3. 5 5 5. 1 2 1 2.">(703) 555-1212</a>
  //
  // Given a string like "1-777-888-9999" it generates an anchor tag like so:
  //
  //   <a href="tel:17778889999" aria-label="1. 7 7 7. 8 8 8. 9 9 9 9.">1-777-888-9999</a>
  hbs.registerHelper("accessible-phone-number", function (
    digitString,
    context
  ) {
    var digits = digitString.split("").filter(function (ch) {
      return "0123456789".indexOf(ch) !== -1;
    });
    var justDigitsString = digits.join("");

    var ariaLabelParts = [];
    var consumeDigits = function (segLen) {
      if (digits.length == 0) {
        // no-op
      } else if (digits.length >= segLen) {
        ariaLabelParts.unshift(".");
        for (var idx = 0; idx < segLen; idx++) {
          ariaLabelParts.unshift(digits.pop());
          ariaLabelParts.unshift(" ");
        }
      } else {
        ariaLabelParts.unshift(".");
        while (digits.length > 0) {
          ariaLabelParts.unshift(digits.pop());
          ariaLabelParts.unshift(" ");
        }
      }
    };

    consumeDigits(4);
    consumeDigits(3);
    consumeDigits(3);
    consumeDigits(999);

    var ariaLabelString = ariaLabelParts.join("");
    return `<a href="tel:${justDigitsString}" aria-label="${ariaLabelString}">${digitString}</a>`;
  });

  hbs.registerPartial(
    "deptva-formation-error",
    fs.readFileSync("views/partials/deptva-formation-error.hbs", {
      encoding: "utf8",
    })
  );

  return hbs;
}
