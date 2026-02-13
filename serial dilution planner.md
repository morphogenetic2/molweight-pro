## Serial dilution planner: specs

The module should have: (some features are already implemented)

Stock concentration selector (OK)
Start concentration (OK)
Volume per step (OK)
Replicates and overage (OK). Minimum one replicate.
A selector for "include blank" or not.
A selector for "number of steps" or "final concentration"
A selector for "dilution" or "concentrations"

Functionally, the user needs to enter the stock concentration, the start concentration, and either the number of steps OR the final concentration.

There are a few different workflows:

-"Auto mode" with dilution, the user enters an initial concentration and the dilution factor (1:n), the dilution progresses until it reaches the final concentration or gets as close as possible but always higher than the final concentration value/
-"Auto mode" with concentrations. The webapp asks the user for the concentration step, i.e. if the user starts with 100 mM and inputs 10, it will to 100, 90, 80, etc. until it reaches the target concentration.
-"Custom mode" with dilution. The user enters a number of steps (samples) and n textboxes appear with a label of the step number on each textbox. The user fills up the dilutions as either 1:n, n or nx (e.g. 1:10, 10, 10x), reformatting the value to 1:n always. In this case, the target concentration is irrelevant, is removed from the UI and the user is the sole responsible for his calculations. Safety checks: dilutions can be 1:1 max, not 1:0.5, etc, in this case warn the user. A "b", "0" or "blank" value equals a blank well.
-"Custom mode" with concentrations. The user enters a number of steps, like before. Then, n textboxes appear with a label of the step number, like before. Then, the user inputs concentrations values, with units. If the units are explicit, keep them (but validate that are equal or lower to the preceding value), if not, use the units used to define the start concentration value. A "0" or "b" or "blank" is a blank well.

Behaviour of overage: If we have only one replicate (let's say 1000 uL) with an overage of 10%, calculate volumes to have that extra 10% on each step, to account for pipetting errors. If we have 2 or more replicates, the overage volume corresponds to 10% of one replicate, i.e. for 3 replicates, we have 3000 uL + 1000*10%= 3100 uL. This is to save reagents but still have a safety margin.

Unit display: We assume that the user will use precision pipettes. For volumes between 0.001 and 2.5 uL, use three decimals (i.e. 1.233 uL). Between 2.501 and 10 uL, use two decimals. Between 10 and 200 uL, round to 0.02 (i.e. 50.04, 104.48) and between 200 and 1000 uL use integers.

Please reply in the chat if the plan is clear and makes sense, and assess feasibility.

