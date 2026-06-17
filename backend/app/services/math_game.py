"""Problem generation for the 'Pet Feast' math game.

Targeted at Philippine Senior High School (Grade 11-12) math. Every problem is
multiple-choice and carries:
  - prompt   : the question
  - answer   : the correct choice (string)
  - choices  : 4 string options including the answer
  - topic    : topic label for display
  - solution : a short step-by-step explanation (shown to teach the student)
"""
import random
from math import comb, perm
from typing import Callable, Dict, List

_SUP = str.maketrans("0123456789-", "⁰¹²³⁴⁵⁶⁷⁸⁹⁻")
_SUBS = str.maketrans("0123456789", "₀₁₂₃₄₅₆₇₈₉")


def _sup(n: int) -> str:
    return str(n).translate(_SUP)


def _sub(n: int) -> str:
    return str(n).translate(_SUBS)


def _signed(n: int) -> str:
    return f" + {n}" if n >= 0 else f" − {abs(n)}"


def _fac(r: int) -> str:
    return f"(x − {r})" if r >= 0 else f"(x + {abs(r)})"


def _choices(answer: str, distractors: List[str]) -> List[str]:
    out = [answer]
    for d in distractors:
        if d not in out:
            out.append(d)
        if len(out) == 4:
            break
    if answer.lstrip("-").isdigit():
        base, k = int(answer), 1
        while len(out) < 4:
            for cand in (str(base + k), str(base - k)):
                if cand not in out:
                    out.append(cand)
                    if len(out) == 4:
                        break
            k += 1
    else:
        i = 1
        while len(out) < 4:
            cand = f"{answer} ·{i}"
            if cand not in out:
                out.append(cand)
            i += 1
    random.shuffle(out)
    return out


def _p(prompt: str, answer: str, distractors: List[str], topic: str, solution: str) -> Dict:
    return {
        "prompt": prompt,
        "answer": answer,
        "choices": _choices(answer, distractors),
        "topic": topic,
        "solution": solution,
    }


# --- generators -------------------------------------------------------------
def _g_function() -> Dict:
    a, b, c = random.randint(1, 4), random.randint(-6, 6), random.randint(-6, 6)
    x = random.randint(-3, 4)
    t1, mid = a * x * x, b * x
    val = t1 + mid + c
    prompt = f"If f(x) = {a}x²{_signed(b)}x{_signed(c)}, find f({x})."
    sol = (
        f"Substitute x = {x}: {a}({x})²{_signed(b)}({x}){_signed(c)} "
        f"= {t1}{_signed(mid)}{_signed(c)} = {val}."
    )
    return _p(prompt, str(val), [str(val + 2), str(val - 3), str(val + 1)], "Functions", sol)


def _g_quadratic() -> Dict:
    r1, r2 = random.randint(-6, 6), random.randint(-6, 6)
    b, c = -(r1 + r2), r1 * r2
    prompt = f"Solve for x:  x²{_signed(b)}x{_signed(c)} = 0"

    def fmt(p, q):
        lo, hi = sorted((p, q))
        return f"x = {lo}, {hi}"

    answer = fmt(r1, r2)
    cands = [
        fmt(-r1, -r2), fmt(r1, -r2), fmt(-r1, r2),
        fmt(r1 + 1, r2), fmt(r1, r2 + 1), fmt(b, c),
        fmt(r1 - 1, r2), fmt(r1, r2 - 1), fmt(r1 + 2, r2 + 1),
    ]
    d: List[str] = []
    for s in cands:
        if s != answer and s not in d:
            d.append(s)
        if len(d) == 3:
            break
    lo, hi = sorted((r1, r2))
    sol = f"Factor: {_fac(r1)}{_fac(r2)} = 0. Set each factor to 0 → x = {lo} or x = {hi}."
    return _p(prompt, answer, d, "Quadratics", sol)


def _g_exponent_law() -> Dict:
    a, b = random.randint(2, 7), random.randint(2, 7)
    ans = f"x{_sup(a + b)}"
    prompt = f"Simplify:  x{_sup(a)} · x{_sup(b)}"
    exps: List[int] = []
    for e in (a * b, a + b + 1, abs(a - b), a + b + 2):
        if e != a + b and e not in exps:
            exps.append(e)
    sol = f"Same base — add the exponents: x{_sup(a)} · x{_sup(b)} = x^({a}+{b}) = x{_sup(a + b)}."
    return _p(prompt, ans, [f"x{_sup(e)}" for e in exps[:3]], "Exponents", sol)


def _g_logarithm() -> Dict:
    base = random.choice([2, 3, 5])
    k = random.randint(2, 4)
    val = base ** k
    prompt = f"Evaluate:  log{_sup(base)}({val})"
    sol = f"Ask: {base} to what power is {val}? {base}{_sup(k)} = {val}, so the answer is {k}."
    return _p(prompt, str(k), [str(k + 1), str(k - 1), str(k + 2)], "Logarithms", sol)


def _g_trig() -> Dict:
    table = {
        ("sin", 30): "1/2", ("sin", 45): "√2/2", ("sin", 60): "√3/2", ("sin", 90): "1", ("sin", 0): "0",
        ("cos", 0): "1", ("cos", 30): "√3/2", ("cos", 45): "√2/2", ("cos", 60): "1/2", ("cos", 90): "0",
        ("tan", 0): "0", ("tan", 30): "√3/3", ("tan", 45): "1", ("tan", 60): "√3",
    }
    (fn, ang), ans = random.choice(list(table.items()))
    pool = list({v for v in table.values()} - {ans})
    random.shuffle(pool)
    prompt = f"Evaluate:  {fn} {ang}°"
    sol = f"{fn} {ang}° is a special angle on the unit circle. Its exact value is {ans}."
    return _p(prompt, ans, pool[:3], "Trigonometry", sol)


def _g_arithmetic_seq() -> Dict:
    a1, d_ = random.randint(1, 9), random.randint(2, 7)
    n = random.randint(6, 12)
    val = a1 + (n - 1) * d_
    prompt = f"Arithmetic sequence: a₁ = {a1}, d = {d_}. Find a{_sub(n)}."
    sol = f"aₙ = a₁ + (n−1)d = {a1} + ({n}−1)({d_}) = {a1} + {(n - 1) * d_} = {val}."
    return _p(prompt, str(val), [str(val + d_), str(val - d_), str(val + d_ + 1)], "Sequences", sol)


def _g_geometric_seq() -> Dict:
    a1, r = random.randint(1, 4), random.randint(2, 3)
    n = random.randint(4, 6)
    val = a1 * r ** (n - 1)
    prompt = f"Geometric sequence: a₁ = {a1}, r = {r}. Find a{_sub(n)}."
    sol = f"aₙ = a₁·r^(n−1) = {a1}·{r}^({n}−1) = {a1}·{r ** (n - 1)} = {val}."
    return _p(prompt, str(val), [str(val * r), str(val + r), str(val - r)], "Sequences", sol)


def _g_derivative() -> Dict:
    a, b, c = random.randint(1, 5), random.randint(1, 6), random.randint(1, 9)
    ans = f"{2 * a}x{_signed(b)}"
    prompt = f"Find the derivative:  d/dx ({a}x²{_signed(b)}x{_signed(c)})"
    sol = (
        f"Power rule: d/dx({a}x²) = {2 * a}x, d/dx({b}x) = {b}, and the constant {c} → 0. "
        f"So the derivative is {2 * a}x{_signed(b)}."
    )
    return _p(prompt, ans, [f"{a}x{_signed(b)}", f"{2 * a}x", f"{2 * a}x{_signed(2 * b)}"], "Basic Calculus", sol)


def _g_limit() -> Dict:
    a = random.randint(3, 8)
    val = 2 * a
    prompt = f"Evaluate:  lim (x→{a}) (x² − {a * a}) / (x − {a})"
    sol = (
        f"Factor the top: x² − {a * a} = (x − {a})(x + {a}). Cancel (x − {a}): "
        f"the limit becomes x + {a}. Substitute x = {a} → {val}."
    )
    return _p(prompt, str(val), [str(a), str(a * a), "0"], "Limits", sol)


def _g_combination() -> Dict:
    n = random.randint(5, 8)
    r = random.randint(2, 3)
    if random.random() < 0.5:
        val = comb(n, r)
        prompt = f"How many ways to choose {r} from {n}?  (C({n}, {r}))"
        sol = f"C({n},{r}) = {n}! / ({r}!·{n - r}!) = {val}. (Order doesn't matter.)"
        d = [str(perm(n, r)), str(val + n), str(comb(n, r + 1))]
    else:
        val = perm(n, r)
        prompt = f"Evaluate the permutation  P({n}, {r})."
        sol = f"P({n},{r}) = {n}! / ({n - r}!) = {val}. (Order matters.)"
        d = [str(comb(n, r)), str(n ** r), str(val - n)]
    return _p(prompt, str(val), d, "Combinatorics", sol)


def _g_probability() -> Dict:
    options = [
        ("A fair die is rolled. P(even number)?", "1/2", ["1/3", "1/6", "2/3"],
         "Even results = {2, 4, 6} → 3 of 6 outcomes → 3/6 = 1/2."),
        ("A fair die is rolled. P(prime number)?", "1/2", ["1/3", "2/3", "1/6"],
         "Primes on a die = {2, 3, 5} → 3 of 6 → 3/6 = 1/2."),
        ("A fair die is rolled. P(number > 4)?", "1/3", ["1/2", "1/6", "2/3"],
         "Greater than 4 = {5, 6} → 2 of 6 → 2/6 = 1/3."),
        ("Two coins are tossed. P(two heads)?", "1/4", ["1/2", "1/3", "3/4"],
         "Outcomes: HH, HT, TH, TT. Only HH works → 1/4."),
        ("A card is drawn from 52. P(a heart)?", "1/4", ["1/13", "1/2", "1/3"],
         "There are 13 hearts in 52 cards → 13/52 = 1/4."),
    ]
    prompt, ans, d, sol = random.choice(options)
    return _p(prompt, ans, d, "Probability", sol)


def _g_interest() -> Dict:
    p = random.choice([5000, 8000, 10000, 12000, 15000])
    rate = random.choice([3, 4, 5, 6])
    t = random.randint(2, 4)
    interest = p * rate * t // 100
    prompt = f"₱{p:,} is invested at {rate}% simple interest for {t} years. Find the interest."
    sol = f"I = P × r × t = ₱{p:,} × {rate}% × {t} = ₱{p:,} × 0.0{rate} × {t} = ₱{interest:,}."
    d = [f"₱{p * rate // 100:,}", f"₱{interest + p:,}", f"₱{p * rate * t // 1000:,}"]
    return _p(prompt, f"₱{interest:,}", d, "General Math", sol)


_GENERATORS: List[Callable[[], Dict]] = [
    _g_function, _g_quadratic, _g_exponent_law, _g_logarithm, _g_trig,
    _g_arithmetic_seq, _g_geometric_seq, _g_derivative, _g_limit,
    _g_combination, _g_probability, _g_interest,
]


def generate_problems(level: int, count: int = 10) -> List[Dict]:
    """Generate `count` SHS-level multiple-choice problems (topics vary)."""
    return [random.choice(_GENERATORS)() for _ in range(count)]
