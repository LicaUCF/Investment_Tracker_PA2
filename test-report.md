# Test report

For checks 1–10 in START_HERE.html: record Pass/Needs work, observed result, and evidence filename where required.

---------------------

# PA2 Test Report

1. Register two fictional users A and B. Duplicate email and invalid password are rejected. Incorrect login produces generic feedback. ->+**Pass**
2. Logged out, purchase requests are rejected. Missing/wrong CSRF token rejects a mutation without changing data. -> **Pass**
3. As A, add Example Index Fund: quantity 5, price $20.00, category Fund; then Example Company: quantity 3, price $15.50, category Stock. Expect two records and $146.50. -> **Pass**
4. Reload, then restart the server and log in again. Both records and $146.50 remain. -> **Pass**
5. Edit the company purchase to quantity 4. Expect $162.00. Delete the fund purchase. Expect one record and $62.00. -> **Pass**
6. As B, see no A records. Direct PUT and DELETE requests targeting A's remaining purchase return 404 and leave it unchanged. Sending A's ID in a body must not change ownership. -> **Pass**
7. Try blank name, quantity 1.5/0/10001, nonnumeric JSON quantity, priceCents 0/1.5/100000001, and an unknown category. Every invalid request is rejected without mutation. -> **Pass**
8. Add the literal name <b>Example</b>. It displays as text. A repeated name creates a separate record. -> **Pass**
9. Stop the server and attempt a save. Show a useful connection error, preserve inputs, and restore the submit button. -> **needs work**
10. Send malformed JSON and request an unknown API route. Receive JSON errors. Inspect repository and submission for secrets and excluded folders. -> **Pass**