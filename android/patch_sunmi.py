import re
import sys

filepath = r"e:\Downloads\demopos\node_modules\@kduma-autoid\capacitor-sunmi-printer\android\src\main\java\dev\duma\capacitor\sunmiprinter\SunmiPrinterPlugin.java"

with open(filepath, 'r', encoding='utf-8') as f:
    content = f.read()

# Pattern to find blocks like:
# implementation.getCallbackHelper().make(isSuccess -> {
#     if (isSuccess) {
#         call.resolve();
#     } else {
#         call.reject("...");
#     }
# })

pattern_make = re.compile(
    r'(implementation\.getCallbackHelper\(\)\.make\(\w+\s*->\s*\{.*?\bcall\.resolve\(\);.*?\}\s*\))',
    re.DOTALL
)

# Replace with implementation.getCallbackHelper().make(isSuccess -> {})
# AND we need to add call.resolve(); right after the try catch or statement.
# Wait, parsing this with regex might be dangerous if we don't insert call.resolve() at the right place.

# Let's use a simpler approach. If we replace `call.resolve();` inside the lambda, it won't be called.
# BUT wait! If I just modify `SunmiCallbackHelper.java` so that EVERY callback proxy immediately invokes its target!
