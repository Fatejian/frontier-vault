---
title: "Python 自动化测试核心概念：从 POM 架构到元素定位与 Driver 工程"
description: 从页面对象模型（POM）架构、XPath 与 CSS Selector 定位策略到 Driver 生命周期管理，系统梳理 Python 自动化测试的工程化要点
category: Testing
tags:
  - Test Automation
  - Python
  - Selenium
  - Page Object Model
  - XPath
  - CSS Selector
  - pytest
readingTime: 22 min
outline: deep
---

# Python 自动化测试核心概念：从 POM 架构到元素定位与 Driver 工程

> 副标题：从页面对象模型（POM）架构、XPath 与 CSS Selector 定位策略到 Driver 生命周期管理，系统梳理 Python 自动化测试的工程化要点
>
> 目标读者：测试工程师、自动化测试开发、Python 后端工程师、质量负责人
>
> 阅读时间：约 22 分钟

::: info 一句话
Python 自动化测试的工程化本质，是通过 POM 架构隔离界面变动、用精准定位策略锁定元素、以 Driver 生命周期管理资源，将一次性脚本变为可持续维护的测试资产。
:::

## 目录

- [写在前面](#写在前面)
- [一、为什么 Python 自动化测试需要工程化：从一次性脚本到测试资产](#一-为什么-python-自动化测试需要工程化-从一次性脚本到测试资产)
- [二、POM 架构：用 Python 类隔离界面变动](#二-pom-架构-用-python-类隔离界面变动)
- [三、POM 的工程化要点：链式调用、组件化与 pytest fixture](#三-pom-的工程化要点-链式调用-组件化与-pytest-fixture)
- [四、定位策略：XPath 与 CSS Selector 的取舍](#四-定位策略-xpath-与-css-selector-的取舍)
- [五、定位器设计：稳定性与可维护性](#五-定位器设计-稳定性与可维护性)
- [六、Driver 工程化：生命周期、等待与资源管理](#六-driver-工程化-生命周期-等待与资源管理)
- [七、Driver 与 POM 的协作模式](#七-driver-与-pom-的协作模式)
- [八、统一模型：POM · 定位 · Driver](#八-统一模型-pom-定位-driver)
- [九、Python 自动化测试实践清单](#九-python-自动化测试实践清单)
- [结语：从脚本到资产的三块基石](#结语-从脚本到资产的三块基石)
- [FAQ](#faq)
- [来源](#来源)

## 写在前面

很多团队对 Python 自动化测试的认知停留在"用 Selenium 写一段脚本能跑通就行"。这种做法能拿到一个粗略的回归结论，但回答不了真正关键的问题：

- 前端把 `id="username"` 改成 `name="username"` 后，几十条用例同时报错，要在哪里改？
- 同一个按钮既可以用 CSS Selector 又可以用 XPath，到底该用哪个？为什么有的定位一改 DOM 就失效？
- 测试跑完浏览器进程还残留在后台，CI 机器内存越跑越满，问题出在哪里？
- 自动化用例增长到几百条后，每次执行都要十几分钟，是测试本身慢还是 Driver 复用出了问题？

如果一篇自动化测试笔记只能给出"POM 是封装页面的类""XPath 比 CSS 慢""driver 要 quit"这种结论，那它几乎没有工程价值。真正可维护的 Python 自动化测试，要把三件事拆清楚：界面变动如何被隔离、元素如何被稳定锁定、浏览器资源如何被生命周期管理。

这三件事构成了一条主线：**POM 是架构基座、定位是精度工具、Driver 是资源边界**。下图展示了三者如何协作把脚本变成资产：

```mermaid
%%{init: {'theme': 'base', 'themeVariables': {'fontFamily': 'Inter, PingFang SC, Microsoft YaHei, sans-serif', 'primaryColor': '#F8FAFC', 'primaryTextColor': '#172033', 'primaryBorderColor': '#CBD5E1', 'lineColor': '#64748B', 'fontSize': '13px'}}}%%
flowchart LR
    Start([一次性脚本])

    subgraph Pipeline[工程化三段]
        direction LR
        S1["POM 架构<br/>隔离界面变动"]
        S2["定位策略<br/>锁定元素"]
        S3["Driver 生命周期<br/>管理资源"]
        S1 --> S2 --> S3
    end

    End([可持续维护的测试资产])

    Start --> Pipeline --> End

    P1["定位散落各处"] -.-> S1
    P2["DOM 一改就失效"] -.-> S2
    P3["浏览器残留泄漏"] -.-> S3

    classDef start fill:#172033,color:#fff,stroke:#172033,stroke-width:2px
    classDef work fill:#ECFDF3,stroke:#22C55E,color:#172033,stroke-width:1.5px
    classDef block fill:#FFF7E6,stroke:#F59E0B,color:#172033,stroke-width:1.5px
    classDef wait fill:#EEF6FF,stroke:#3B82F6,color:#172033,stroke-width:1.5px

    class Start start
    class S1,S2,S3 work
    class P1,P2,P3 block
    class End wait
```

本文按照"架构 → 定位 → 资源"的顺序展开，每一阶段都标注常见误区与可执行的工程实践。

---

## 一、为什么 Python 自动化测试需要工程化：从一次性脚本到测试资产

很多人把 Python 自动化测试等同于"用 Selenium 写几段 `find_element` 跑通登录流程"。这是一种窄化的理解。当用例从十几条增长到几百条、当 UI 迭代从月一次变成日一次、当 CI 需要并行跑几百个浏览器实例时，没有工程化的脚本会迅速退化为维护噩梦。

Python 自动化测试的工程化价值可以归纳为以下几方面：

1. **隔离界面变动**：前端把 `id` 改为 `name`、把 `input` 换成 `div + contenteditable`，工程化的测试只需修改一处定位器，所有用例零变动。
2. **稳定锁定元素**：动态列表、异步加载、影子 DOM 等场景下，定位器的设计直接决定用例的稳定性。工程化的测试用稳定语义而非脆弱结构定位元素。
3. **资源生命周期可控**：浏览器进程的创建、复用、销毁由 fixture 统一管理，避免 CI 机器内存泄漏、避免并行测试相互污染。
4. **复用与组合**：公共头部、底部、弹窗等可抽成 `Component` 类，通过组合方式引入页面对象，符合 Python 的"组合优于继承"理念。
5. **可读性接近自然语言**：测试用例只与页面对象交互，代码读起来像 `LoginPage(driver).enter_username("admin").click_login()`，产品和手工测试同事都能看懂。
6. **与 pytest 生态无缝集成**：driver 通过 fixture 注入，页面对象之间通过返回值传递，类型提示让 IDE 智能补全链式调用。

::: tip 本节核心结论

Python 自动化测试的工程化不只是"写脚本"，而是把架构、定位、资源三件事工程化。它把一次性脚本变成可持续维护的测试资产，让 UI 频繁迭代下的用例维护成本从线性增长降到接近常数。

:::

::: warning 常见误区

把自动化测试等同于"录制回放 + 凑一批 find_element 脚本"。这种做法在用例少于 20 条时还能勉强维护，一旦页面重构或用例规模扩张，维护成本会以远超线性速度增长，最终导致整个自动化测试体系被废弃。

:::

---

## 二、POM 架构：用 Python 类隔离界面变动

要把自动化测试从"散落脚本"升级为"工程方法"，第一个需要建立的概念是页面对象模型（Page Object Model, POM）。POM 的核心思想是把每一个网页或独立区块封装成一个 Python 类，让测试用例只与页面对象交互，完全不触碰底层 driver 和元素定位细节。

### 1. 没有 POM 的脚本：定位散落各处

在 Python 的 Selenium 自动化初期，测试脚本往往直接操作底层 driver：

```python
# 反例：定位散落在用例各处，界面一变就要改几十条用例
def test_login_success(driver):
    driver.find_element(By.ID, "username").send_keys("admin")
    driver.find_element(By.ID, "password").send_keys("123456")
    driver.find_element(By.ID, "loginBtn").click()
    assert driver.find_element(By.ID, "welcome").text == "欢迎回来"
```

这种方式会导致元素定位散落在各处，界面一有变动就需要修改大量用例，维护成本极高。当前端把 `id="loginBtn"` 改成 `class="btn-submit"` 时，所有引用 `loginBtn` 的用例都会同时失败。

### 2. POM 的本质：三类映射

**页面对象模型**将每一个网页（或独立区块）封装成一个 **Python 类**，建立三类映射：

- 页面上的元素 → 类的属性（定位器元组）
- 页面提供的操作 → 类的方法
- 操作后的跳转 → 方法返回下一个页面对象（链式调用）

测试用例只与页面对象交互，完全不触碰底层 driver 和元素定位细节。这样界面变动的影响被限制在单个类内部。

```python
# 正例：POM 封装后，定位器集中管理，界面变动只改一处
from selenium.webdriver.common.by import By
from selenium.webdriver.remote.webdriver import WebDriver


class LoginPage:
    """登录页面对象"""

    def __init__(self, driver: WebDriver):
        self.driver = driver
        # 元素定位器集中管理
        self._username = (By.ID, "username")
        self._password = (By.ID, "password")
        self._login_btn = (By.ID, "loginBtn")
        self._error_msg = (By.CLASS_NAME, "error")

    def enter_username(self, username: str) -> "LoginPage":
        self.driver.find_element(*self._username).send_keys(username)
        return self  # 返回自身，支持链式调用

    def enter_password(self, password: str) -> "LoginPage":
        self.driver.find_element(*self._password).send_keys(password)
        return self

    def click_login(self) -> "HomePage":
        self.driver.find_element(*self._login_btn).click()
        return HomePage(self.driver)  # 跳转到首页

    def click_login_expecting_failure(self) -> "LoginPage":
        self.driver.find_element(*self._login_btn).click()
        return self  # 仍停留在登录页

    def get_error_message(self) -> str:
        return self.driver.find_element(*self._error_msg).text


class HomePage:
    """首页对象"""

    def __init__(self, driver: WebDriver):
        self.driver = driver
        self._welcome = (By.ID, "welcome")

    def get_welcome_message(self) -> str:
        return self.driver.find_element(*self._welcome).text
```

### 3. 测试用例层：从命令式到声明式

POM 封装完成后，测试用例层只与页面对象交互，代码从"命令式操作 driver"变成"声明式描述业务流程"：

```python
# 正例：用例只描述业务流程，不触碰 driver 与定位
def test_login_success(driver):
    login_page = LoginPage(driver)
    home_page = (
        login_page.enter_username("admin")
        .enter_password("123456")
        .click_login()
    )
    assert home_page.get_welcome_message() == "欢迎回来"
```

当前端把 `id="loginBtn"` 改成 `class="btn-submit"` 时，只需要修改 `LoginPage` 中的 `self._login_btn` 一处，所有用例零变动。这就是 POM 隔离界面变动的核心价值。

下图展示了 POM 的三层结构与数据流方向：

```mermaid
%%{init: {'theme': 'base', 'themeVariables': {'fontFamily': 'Inter, PingFang SC, Microsoft YaHei, sans-serif', 'primaryColor': '#F8FAFC', 'primaryTextColor': '#172033', 'primaryBorderColor': '#CBD5E1', 'lineColor': '#64748B', 'fontSize': '13px'}}}%%
flowchart TB
    Core["POM 三层结构<br/>隔离界面变动"]

    subgraph Layer1["测试用例层"]
        T1["test_login_success"]
        T2["test_login_failure"]
        T3["test_logout"]
    end

    subgraph Layer2["页面对象层"]
        P1["LoginPage<br/>定位器 + 操作方法"]
        P2["HomePage<br/>定位器 + 操作方法"]
        P3["ProfilePage<br/>定位器 + 操作方法"]
    end

    subgraph Layer3["Driver 层"]
        D1["find_element"]
        D2["click / send_keys"]
        D3["WebDriver 句柄"]
    end

    Core --> Layer1
    Core --> Layer2
    Core --> Layer3

    T1 -->|"实例化 + 链式调用"| P1
    T1 -->|"返回 HomePage"| P2
    P1 -->|"封装调用"| D1
    P2 -->|"封装调用"| D2

    Change["前端改 id 为 class"] -.->|"只改一处"| P1

    classDef core fill:#172033,color:#fff,stroke:#172033,stroke-width:2px
    classDef work fill:#ECFDF3,stroke:#22C55E,color:#172033,stroke-width:1.5px
    classDef wait fill:#EEF6FF,stroke:#3B82F6,color:#172033,stroke-width:1.5px
    classDef block fill:#FFF7E6,stroke:#F59E0B,color:#172033,stroke-width:1.5px

    class Core core
    class T1,T2,T3 wait
    class P1,P2,P3 work
    class D1,D2,D3 block
    class Change block
```

::: tip 本节核心结论

POM 把页面元素封装成 Python 类，建立"元素 → 属性、操作 → 方法、跳转 → 返回值"的三类映射，让界面变动的影响被限制在单个类内部。这是 Python UI 自动化从"一次性脚本"走向"可持续维护工程"的架构基座。

:::

::: warning 常见误区

把页面对象当成"放定位器的工具类"，在页面对象里塞满 `assert`。正确的做法是页面对象只提供服务（操作 + 状态查询），断言留在测试用例层。一旦页面对象包含断言，它就同时承担了"页面建模"和"测试验证"两个职责，复用性会大幅下降。

:::

---

## 三、POM 的工程化要点：链式调用、组件化与 pytest fixture

把 POM 写成一个 Python 类只是起点。要在工程化项目中真正发挥价值，还需要解决三个问题：链式调用如何让用例可读、复用组件如何避免重复、driver 生命周期如何与 pytest fixture 解耦。

### 1. 链式调用与方法返回值

POM 的方法返回值决定了用例的可读性。一个好的实践是：**操作方法返回自身以支持链式调用，跳转方法返回下一个页面对象**。这样用例代码读起来像自然语言：

```python
# 正例：链式调用让用例接近自然语言
HomePage = (
    LoginPage(driver)
    .enter_username("admin")
    .enter_password("123456")
    .click_login()
)
```

类型提示 `-> "LoginPage"` 和 `-> "HomePage"` 让 IDE 能智能补全链式调用的可用方法，这是 Python 生态相对其他动态语言的核心优势。

```python
# 反例：方法返回 None，链式调用断裂，用例变成命令式堆叠
login_page = LoginPage(driver)
login_page.enter_username("admin")
login_page.enter_password("123456")
home_page = login_page.click_login()
```

### 2. 组件化：组合优于继承

复杂页面中往往有公共区块（顶部导航、底部链接、用户菜单、表格、弹窗）。把这些区块抽成 `Component` 类，通过组合方式引入页面对象，符合 Python 的"组合优于继承"理念：

```python
# 正例：复用组件通过组合引入，符合"组合优于继承"
class HeaderComponent:
    """公共头部组件"""

    def __init__(self, driver: WebDriver):
        self.driver = driver
        self._user_menu = (By.ID, "userMenu")
        self._logout_btn = (By.ID, "logout")

    def open_user_menu(self) -> "HeaderComponent":
        self.driver.find_element(*self._user_menu).click()
        return self

    def click_logout(self) -> "LoginPage":
        self.driver.find_element(*self._logout_btn).click()
        return LoginPage(self.driver)


class HomePage:
    """首页对象，组合 Header 组件"""

    def __init__(self, driver: WebDriver):
        self.driver = driver
        self.header = HeaderComponent(driver)  # 组合而非继承
        self._welcome = (By.ID, "welcome")

    def get_welcome_message(self) -> str:
        return self.driver.find_element(*self._welcome).text
```

### 3. 页面对象不包含断言

页面对象只提供服务，不包含断言。状态查询用 `@property` 暴露，断言留在测试用例层：

```python
# 反例：页面对象包含断言，复用性下降
class LoginPage:
    def login_and_assert_success(self, username, password):
        self.driver.find_element(*self._login_btn).click()
        assert "欢迎" in self.driver.title  # 断言耦合在页面对象内


# 正例：页面对象只提供服务，断言留在用例
class LoginPage:
    @property
    def error_message(self) -> str:
        return self.driver.find_element(*self._error_msg).text

    def click_login_expecting_failure(self) -> "LoginPage":
        self.driver.find_element(*self._login_btn).click()
        return self


def test_login_failure(driver):
    page = LoginPage(driver).enter_username("bad").enter_password("bad").click_login_expecting_failure()
    assert "用户名或密码错误" in page.error_message
```

### 4. 与 pytest fixture 解耦

driver 的生命周期由 pytest fixture 管理，页面对象通过构造函数接收 driver。这样用例、页面对象、driver 三层完全解耦：

```python
# 正例：driver 由 fixture 注入，页面对象在用例中实例化
def test_login_success(driver):
    home_page = LoginPage(driver).enter_username("admin").enter_password("123456").click_login()
    assert home_page.get_welcome_message() == "欢迎回来"
```

页面对象也可以直接作为更高级的 fixture，进一步减少用例样板代码：

```python
# 正例：把页面对象也封装成 fixture，用例更聚焦
import pytest


@pytest.fixture
def login_page(driver):
    return LoginPage(driver)


def test_login_success(login_page):
    home_page = login_page.enter_username("admin").enter_password("123456").click_login()
    assert home_page.get_welcome_message() == "欢迎回来"
```

::: tip 本节核心结论

POM 的工程化要点是"链式调用 + 组件化 + fixture 解耦"：操作方法返回自身以支持链式调用，复用区块抽成 Component 通过组合引入，driver 由 pytest fixture 注入实现生命周期与用例解耦。页面对象只提供服务不包含断言，是保证可复用性的边界。

:::

::: info 工程启示

Python 的类型提示是 POM 工程化的隐藏优势。`-> "HomePage"` 这种字符串前向引用让 IDE 能在链式调用时智能补全下一级方法，对于复杂业务流程（登录 → 下单 → 支付 → 回单）的页面对象链尤其有价值，相当于把业务流程编码进了类型系统。

:::

---

## 四、定位策略：XPath 与 CSS Selector 的取舍

POM 解决了"界面变动如何隔离"的问题，但定位器本身的设计决定了"元素能否被稳定锁定"。Python Selenium 提供了多种定位方式（ID、CLASS_NAME、NAME、TAG_NAME、XPath、CSS Selector），其中 XPath 与 CSS Selector 是功能最强、也最容易误用的两种。

### 1. XPath：双向遍历与文本匹配

XPath 是通过路径表达式在 XML/HTML 中查找节点的语言。它的核心优势是支持双向遍历（父子兄弟）、文本匹配、丰富的函数：

```python
from selenium.webdriver.common.by import By

# 通过文本定位（CSS Selector 做不到）
driver.find_element(By.XPATH, "//button[text()='登录']")

# 通过部分属性
driver.find_element(By.XPATH, "//input[contains(@class, 'user')]")

# 兄弟节点遍历（CSS Selector 做不到）
driver.find_element(By.XPATH, "//label[text()='密码']/following-sibling::input")

# 父子双向遍历
driver.find_element(By.XPATH, "//span[@class='icon']/parent::button")
```

XPath 的代价是性能：复杂路径表达式需要遍历 DOM 树，比浏览器原生 CSS 引擎慢。

### 2. CSS Selector：速度与简洁

CSS Selector 是样式表中选择 HTML 元素的模式，用于定位元素。它的核心优势是速度快、语法简洁、与前端开发一致；不支持原生文本匹配是它的最大局限：

```python
driver.find_element(By.CSS_SELECTOR, "#username")
driver.find_element(By.CSS_SELECTOR, "input[name='password']")
driver.find_element(By.CSS_SELECTOR, "button.submit:first-child")
driver.find_element(By.CSS_SELECTOR, "form.login > button[type='submit']")
```

### 3. 对比与选择策略

| 特性        | XPath              | CSS Selector           |
| ----------- | ------------------ | ---------------------- |
| 遍历方向    | 双向（父子、兄弟） | 单向（仅向下）         |
| 文本定位    | 支持               | 不支持                 |
| 性能        | 较慢（复杂路径）   | 更快，浏览器原生优化   |
| 函数/运算符 | 丰富               | 较少（依赖属性与伪类） |
| 前端共识    | 测试专属           | 与前端开发一致         |

**选择策略**：优先 CSS Selector（ID、Class、属性），遇到文本匹配或复杂 DOM 关系时用 XPath。

下图展示了定位策略的决策路径：

```mermaid
%%{init: {'theme': 'base', 'themeVariables': {'fontFamily': 'Inter, PingFang SC, Microsoft YaHei, sans-serif', 'primaryColor': '#F8FAFC', 'primaryTextColor': '#172033', 'primaryBorderColor': '#CBD5E1', 'lineColor': '#64748B', 'fontSize': '13px'}}}%%
flowchart TB
    Start(["需要定位一个元素"])

    Start --> Q1{"有稳定的 id / name?"}
    Q1 -->|"是"| R1["By.ID / By.NAME<br/>最稳定"]
    Q1 -->|"否"| Q2{"需要文本匹配<br/>或父子兄弟遍历?"}
    Q2 -->|"是"| R2["XPath<br/>text() / following-sibling"]
    Q2 -->|"否"| Q3{"class / 属性组合<br/>是否稳定?"}
    Q3 -->|"是"| R3["CSS Selector<br/>速度更快"]
    Q3 -->|"否"| R4["重构前端或加 data-testid<br/>不要在脆弱结构上定位"]

    classDef start fill:#172033,color:#fff,stroke:#172033,stroke-width:2px
    classDef question fill:#F5E8FF,stroke:#A855F7,color:#172033,stroke-width:2px
    classDef work fill:#ECFDF3,stroke:#22C55E,color:#172033,stroke-width:1.5px
    classDef block fill:#FFF7E6,stroke:#F59E0B,color:#172033,stroke-width:1.5px
    classDef wait fill:#EEF6FF,stroke:#3B82F6,color:#172033,stroke-width:1.5px

    class Start start
    class Q1,Q2,Q3 question
    class R1,R3 work
    class R2 wait
    class R4 block
```

::: tip 本节核心结论

XPath 与 CSS Selector 不是"二选一"的对立关系，而是分工互补：CSS Selector 速度更快、与前端共识一致，作为默认选择；XPath 在需要文本匹配或父子兄弟遍历时启用。定位策略的真正起点是有稳定的 id/name，没有的话优先推动前端加 `data-testid`，而不是在脆弱结构上玩定位技巧。

:::

::: warning 常见误区

盲目追求"会用 XPath 写复杂路径"作为技术能力的体现。复杂的 XPath（如 `//div[3]/ul/li[2]/a`）依赖绝对位置，DOM 一改就失效，是自动化测试最大的脆弱性来源。能用 id/name 解决的问题，不要用 XPath 复杂路径。

:::

---

## 五、定位器设计：稳定性与可维护性

定位策略选完之后，真正决定用例稳定性的是定位器的设计。同一个元素往往有多种定位方式，选哪种决定了"用例能跑多久不被前端改动打断"。

### 1. 优先级：id > name > class > 复杂结构

定位器的优先级应该遵循"稳定性递减"原则：

- **id**：全页面唯一，最稳定，前端基本不会随意改 id。
- **name**：表单元素常见，稳定性仅次于 id。
- **data-testid**：测试专用属性，前端明确知道它是为测试服务的，不会随意改动。
- **class**：要区分语义类（如 `.login-form`）和样式类（如 `.btn-primary`、`.mt-4`），前者相对稳定，后者会随样式重构频繁变化。
- **复杂结构**：如 `div > ul > li:nth-child(3) > a`，依赖绝对位置和层级，最脆弱。

```python
# 反例：依赖绝对位置和样式类，前端一改就失效
_login_btn = (By.CSS_SELECTOR, "div:nth-child(2) > form > button.btn-primary.mt-4")

# 正例：用稳定的 id 或 data-testid
_login_btn = (By.ID, "loginBtn")
_password = (By.CSS_SELECTOR, "input[data-testid='password-input']")
```

### 2. 推动前端加 data-testid

当既没有稳定 id 也没有稳定 name 时，不要在脆弱的 class 或结构上玩定位技巧，而是推动前端加 `data-testid` 属性。`data-testid` 是测试专用属性，前端明确知道它是为测试服务的，重构样式时不会动它：

```html
<!-- 前端代码 -->
<button data-testid="submit-login">登录</button>
```

```python
# 测试代码
_login_btn = (By.CSS_SELECTOR, "[data-testid='submit-login']")
```

### 3. 定位器集中管理

定位器应该作为类属性集中管理，而不是散落在方法内部。这样前端改 id 时只需修改一处：

```python
# 反例：定位器散落在方法内
class LoginPage:
    def enter_username(self, username):
        self.driver.find_element(By.ID, "username").send_keys(username)

    def get_error(self):
        return self.driver.find_element(By.CLASS_NAME, "error").text


# 正例：定位器作为类属性集中管理
class LoginPage:
    _username = (By.ID, "username")
    _error_msg = (By.CLASS_NAME, "error")

    def enter_username(self, username):
        self.driver.find_element(*self._username).send_keys(username)

    def get_error(self):
        return self.driver.find_element(*self._error_msg).text
```

### 4. 避免绝对 XPath

绝对 XPath（如 `/html/body/div[2]/form/button[1]`）是定位器设计的反面教材。它依赖从根节点开始的完整路径，任何一层 DOM 改动都会让它失效。应该用相对 XPath（以 `//` 开头）配合稳定的锚点：

```python
# 反例：绝对 XPath，任何一层 DOM 改动都失效
_submit = (By.XPATH, "/html/body/div[2]/form/div[3]/button[1]")

# 正例：相对 XPath + 稳定文本锚点
_submit = (By.XPATH, "//button[text()='提交']")
```

::: tip 本节核心结论

定位器设计的核心是"稳定性优先于技巧"：优先级遵循 id > name > data-testid > 语义 class > 复杂结构的递减原则；定位器作为类属性集中管理；当没有稳定锚点时推动前端加 data-testid 而不是在脆弱结构上玩定位技巧；绝对 XPath 是反面教材，必须用相对 XPath 配合稳定锚点。

:::

::: warning 常见误区

把"会写复杂 XPath"等同于"定位能力强"。复杂 XPath 往往意味着脆弱性。真正强的定位能力体现在：能用最简单的 id/name 解决就不用复杂结构，能推动前端加 data-testid 就不在样式类上死磕，能把定位器集中管理让前端改动的影响最小化。

:::

---

## 六、Driver 工程化：生命周期、等待与资源管理

POM 解决了架构问题，定位器解决了精度问题，剩下的核心问题是资源问题——浏览器进程的创建、复用、销毁如何被生命周期管理。Driver 工程化做得不好，CI 机器会越跑越慢、并行测试会相互污染、用例执行时间会不可控地膨胀。

### 1. Driver 是什么

在 Python Selenium 中，`driver` 是 `webdriver.Chrome()`（或其他浏览器）创建的**浏览器控制句柄**，相当于"遥控器"。你通过它向真实浏览器发送指令：

```python
from selenium import webdriver

driver = webdriver.Chrome()   # 启动 Chrome 浏览器
driver.get("https://example.com")
driver.find_element(By.ID, "kw").send_keys("Python")
driver.quit()
```

driver 的核心功能覆盖五个方面：

- 控制浏览器窗口：`driver.maximize_window()`, `driver.back()`, `driver.forward()`
- 元素定位与交互：`driver.find_element(By.ID, "id")`
- 脚本执行：`driver.execute_script("return document.title")`
- 等待：`driver.implicitly_wait(10)`（更推荐使用显式等待）
- 截图：`driver.save_screenshot("screen.png")`

### 2. 生命周期管理：pytest fixture 统一收口

在 Python 测试中，driver 的生命周期必须由 pytest fixture 统一管理，确保资源释放。fixture 的 `yield` 之前是创建逻辑，之后是清理逻辑，即使用例抛异常也能保证 `quit()` 被执行：

```python
# 反例：在用例里手动创建和销毁 driver，异常时容易泄漏
def test_login():
    driver = webdriver.Chrome()
    driver.get("https://example.com")
    assert "Example" in driver.title
    driver.quit()  # 如果 assert 抛异常，这行不会执行


# 正例：driver 由 fixture 统一管理，yield 之后必执行
# conftest.py
import pytest
from selenium import webdriver


@pytest.fixture(scope="function")  # 每个测试函数一个 driver，保证隔离性
def driver():
    options = webdriver.ChromeOptions()
    options.add_argument("--headless")  # 无头模式，CI 常用
    options.add_argument("--no-sandbox")
    options.add_argument("--disable-dev-shm-usage")
    drv = webdriver.Chrome(options=options)
    drv.implicitly_wait(10)
    yield drv
    drv.quit()  # 测试结束后彻底关闭，即使用例抛异常也会执行
```

### 3. 作用域选择：function / class / session

fixture 的 `scope` 参数决定了 driver 的复用粒度：

- **`function`**（默认推荐）：每个测试函数一个 driver，完全隔离。用例之间无状态污染，但启动开销最大。
- **`class`**：类内所有用例共享一个 driver，适合一组相关用例共享登录态。要注意用例之间不能互相污染状态。
- **`session`**：全局共享一个 driver，慎用。一旦某个用例让浏览器进入异常状态，后续所有用例都会失败。

```python
# 反例：session 作用域下用例间状态污染
@pytest.fixture(scope="session")
def driver():
    drv = webdriver.Chrome()
    yield drv
    drv.quit()

# 测试用例 A 登录后没退出 → 用例 B 一开始就是已登录状态 → 用例 B 假设未登录，断言失败


# 正例：function 作用域隔离每个用例
@pytest.fixture(scope="function")
def driver():
    drv = webdriver.Chrome()
    yield drv
    drv.quit()
```

### 4. 等待策略：显式等待优先于隐式等待

driver 的等待策略是用例稳定性的关键。隐式等待全局生效但条件粗糙（只等元素出现），显式等待可以定制条件（等元素可见、可点击、包含特定文本）：

```python
# 反例：全局隐式等待 + sleep 硬等待
driver.implicitly_wait(10)
import time
time.sleep(3)  # 不可控，CI 上拖慢执行


# 正例：显式等待定制条件
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC


def wait_for_login_button(driver, timeout=10):
    WebDriverWait(driver, timeout).until(
        EC.element_to_be_clickable((By.ID, "loginBtn"))
    )
```

显式等待应该封装在页面对象内部，测试用例完全不用关心等待逻辑：

```python
class LoginPage:
    def __init__(self, driver: WebDriver):
        self.driver = driver
        self._login_btn = (By.ID, "loginBtn")
        self._wait = WebDriverWait(driver, 10)

    def click_login(self) -> "HomePage":
        button = self._wait.until(EC.element_to_be_clickable(self._login_btn))
        button.click()
        return HomePage(self.driver)
```

### 5. quit 与 close 的区别

这是面试常问、工程中也常错的点：

- **`driver.quit()`**：关闭整个浏览器并退出驱动服务，释放所有资源。
- **`driver.close()`**：仅关闭当前窗口，浏览器进程和驱动服务仍在运行。

```python
# 反例：用 close 代替 quit，浏览器进程残留
@pytest.fixture
def driver():
    drv = webdriver.Chrome()
    yield drv
    drv.close()  # 浏览器进程仍在后台，CI 跑一晚会内存爆炸


# 正例：用 quit 彻底清理
@pytest.fixture
def driver():
    drv = webdriver.Chrome()
    yield drv
    drv.quit()  # 关闭浏览器 + 退出驱动服务，彻底释放
```

下图展示了 Driver 从创建到销毁的完整生命周期：

```mermaid
%%{init: {'theme': 'base', 'themeVariables': {'fontFamily': 'Inter, PingFang SC, Microsoft YaHei, sans-serif', 'primaryColor': '#F8FAFC', 'primaryTextColor': '#172033', 'primaryBorderColor': '#CBD5E1', 'lineColor': '#64748B', 'fontSize': '13px'}}}%%
flowchart TB
    Core["Driver 生命周期<br/>资源边界管理"]

    subgraph Create["创建阶段"]
        C1["配置 ChromeOptions<br/>--headless / --no-sandbox"]
        C2["webdriver.Chrome(options)<br/>启动浏览器进程"]
        C3["implicitly_wait<br/>设置基础等待"]
    end

    subgraph Use["使用阶段"]
        U1["driver.get(url)<br/>打开页面"]
        U2["find_element + 交互<br/>定位与操作"]
        U3["WebDriverWait<br/>显式等待"]
        U4["save_screenshot<br/>失败截图"]
    end

    subgraph Cleanup["清理阶段"]
        Q1{"用例结束"}
        Q1 -->|"yield 之后"| D1["driver.quit()<br/>关闭浏览器 + 退出服务"]
        Q1 -->|"异常路径"| D1
    end

    Core --> Create
    Create --> Use
    Use --> Cleanup

    Leak["driver.close() 仅关窗口<br/>进程残留内存泄漏"] -.->|"反例"| Q1

    classDef core fill:#172033,color:#fff,stroke:#172033,stroke-width:2px
    classDef wait fill:#EEF6FF,stroke:#3B82F6,color:#172033,stroke-width:1.5px
    classDef work fill:#ECFDF3,stroke:#22C55E,color:#172033,stroke-width:1.5px
    classDef block fill:#FFF7E6,stroke:#F59E0B,color:#172033,stroke-width:1.5px
    classDef metric fill:#F5E8FF,stroke:#A855F7,color:#172033,stroke-width:2px

    class Core core
    class C1,C2,C3 wait
    class U1,U2,U3,U4 work
    class D1 block
    class Q1 metric
    class Leak block
```

::: tip 本节核心结论

Driver 工程化的核心是"生命周期由 fixture 统一收口、显式等待优先于隐式等待、quit 而非 close 清理资源"。fixture 的 yield 机制保证即使用例抛异常也能执行 quit；显式等待封装在页面对象内部让用例无感知；quit 关闭整个浏览器和驱动服务，是 CI 资源不泄漏的底线。

:::

::: warning 常见误区

在 CI 上用 `driver.close()` 代替 `driver.quit()` 节省几秒钟。close 只关闭当前窗口，浏览器进程和 chromedriver 服务仍在后台运行。一个 CI 任务跑几百条用例后，机器上会累积几十个僵尸浏览器进程，内存越跑越满，最终导致 CI 节点不可用。必须用 quit 彻底清理。

:::

---

## 七、Driver 与 POM 的协作模式

POM 与 Driver 不是两个孤立的概念，而是通过构造函数注入的方式协作。理解这种协作模式，才能避免"在页面对象里直接 `webdriver.Chrome()`"或"在用例里直接操作 driver"这两种典型反模式。

### 1. 注入模式：driver 通过构造函数传递

页面对象通过构造函数接收 driver，不自己创建 driver。这样 driver 的生命周期由 fixture 统一管理，页面对象只负责使用：

```python
# 反例：页面对象自己创建 driver，生命周期失控
class LoginPage:
    def __init__(self):
        self.driver = webdriver.Chrome()  # 谁来 quit？无法管控

    def login(self, username, password):
        # ...
        pass


# 正例：driver 通过构造函数注入，生命周期由 fixture 管控
class LoginPage:
    def __init__(self, driver: WebDriver):
        self.driver = driver  # 只使用，不创建

    def login(self, username, password) -> "HomePage":
        # ...
        return HomePage(self.driver)  # 跳转时把 driver 传递给下一个页面对象
```

### 2. 跳转链：driver 在页面对象之间传递

POM 的跳转方法返回下一个页面对象时，会把同一个 driver 实例传递过去。这样一次测试会话内只使用一个 driver，从 `LoginPage` 到 `HomePage` 到 `ProfilePage` 形成一条跳转链：

```python
# 正例：driver 在页面对象跳转链中传递
def test_user_flow(driver):
    home_page = LoginPage(driver).enter_username("admin").enter_password("123456").click_login()
    profile_page = home_page.open_profile()
    profile_page.update_nickname("new_name")
    assert profile_page.get_nickname() == "new_name"
```

整个流程只使用一个 driver 实例，由 fixture 在用例结束时统一 quit。

### 3. 并行测试：每个进程独立 driver

使用 `pytest-xdist` 并行执行时，每个工作进程有自己的 driver 实例，无需额外处理线程安全：

```python
# 正例：pytest-xdist 并行，每个进程独立 driver
# 命令：pytest -n 4  (4 个工作进程并行)
@pytest.fixture(scope="function")
def driver():
    drv = webdriver.Chrome()
    yield drv
    drv.quit()
```

但要注意：如果多个用例操作同一份数据（如都改同一个用户的状态），并行执行会产生数据竞争。解决方法是数据隔离——每个用例用独立的测试账号。

### 4. RemoteWebDriver：分布式执行

连接 Selenium Grid 或云测平台（如 BrowserStack、Sauce Labs）实现分布式执行，只需把 `webdriver.Chrome()` 换成 `webdriver.Remote()`：

```python
# 正例：连接 Selenium Grid 分布式执行
@pytest.fixture
def driver():
    options = webdriver.ChromeOptions()
    drv = webdriver.Remote(
        command_executor="http://selenium-grid:4444/wd/hub",
        options=options,
    )
    yield drv
    drv.quit()
```

这种模式下 driver 仍然由 fixture 管理，用例和页面对象的代码完全不变。这是 POM + fixture 架构的可扩展性体现。

::: tip 本节核心结论

Driver 与 POM 的协作遵循"注入 + 跳转链 + 并行隔离"模式：driver 通过构造函数注入页面对象，跳转方法把同一个 driver 传递给下一个页面对象形成跳转链，并行测试时每个进程独立 driver 实现数据隔离。这种协作让 driver 生命周期完全由 fixture 管控，页面对象只负责使用，用例层完全不感知 driver 的存在。

:::

::: info 工程启示

把 `webdriver.Chrome()` 换成 `webdriver.Remote()` 即可接入 Selenium Grid 或云测平台，用例和页面对象代码完全不变。这种"换 driver 不改业务代码"的可扩展性，是 POM + fixture 架构相比"散落脚本"的核心工程价值——同一套测试用例既能在本地跑单机回归，也能在 CI 上跑分布式全量。

:::

---

## 八、统一模型：POM · 定位 · Driver

把前面散落的观点归并为统一框架，Python 自动化测试的工程化要点可以映射到三个维度：**POM 隔离变动、定位锁定元素、Driver 管理资源**。下图汇总了三个维度的具体内容、协作关系与对应策略：

```mermaid
%%{init: {'theme': 'base', 'themeVariables': {'fontFamily': 'Inter, PingFang SC, Microsoft YaHei, sans-serif', 'primaryColor': '#F8FAFC', 'primaryTextColor': '#172033', 'primaryBorderColor': '#CBD5E1', 'lineColor': '#64748B', 'fontSize': '13px'}}}%%
flowchart TB
    Core["Python 自动化测试工程化<br/>POM · 定位 · Driver"]

    subgraph POM["POM - 隔离界面变动"]
        P1["元素 → 类属性"]
        P2["操作 → 类方法"]
        P3["跳转 → 返回值链式调用"]
        P4["组件 → 组合引入"]
    end

    subgraph Loc["定位 - 锁定元素"]
        L1["优先级：id > name > data-testid"]
        L2["CSS Selector 默认选择"]
        L3["XPath 文本/遍历时启用"]
        L4["定位器集中管理"]
    end

    subgraph Drv["Driver - 管理资源"]
        D1["fixture 统一生命周期"]
        D2["显式等待优先"]
        D3["quit 而非 close"]
        D4["function 作用域隔离"]
    end

    Core --> POM
    Core --> Loc
    Core --> Drv

    POM --> S1["策略：页面对象不含断言<br/>用例只描述业务流程"]
    Loc --> S2["策略：推动前端加 data-testid<br/>不在脆弱结构上定位"]
    Drv --> S3["策略：yield 必 quit<br/>封装显式等待到页面对象"]

    classDef core fill:#172033,color:#fff,stroke:#172033,stroke-width:2px
    classDef wait fill:#EEF6FF,stroke:#3B82F6,color:#172033,stroke-width:1.5px
    classDef work fill:#ECFDF3,stroke:#22C55E,color:#172033,stroke-width:1.5px
    classDef block fill:#FFF7E6,stroke:#F59E0B,color:#172033,stroke-width:1.5px
    classDef strategy fill:#F8FAFC,stroke:#64748B,color:#172033,stroke-width:1.5px

    class Core core
    class P1,P2,P3,P4 wait
    class L1,L2,L3,L4 work
    class D1,D2,D3,D4 block
    class S1,S2,S3 strategy
```

### 1. POM 维度：隔离界面变动

POM 维度建立"元素 → 属性、操作 → 方法、跳转 → 返回值、组件 → 组合"的四类映射。界面变动的影响被限制在单个页面对象内部，用例零变动。页面对象不含断言，只提供服务，用例层只描述业务流程。

### 2. 定位维度：锁定元素

定位维度遵循"优先级递减"原则：id > name > data-testid > 语义 class > 复杂结构。CSS Selector 作为默认选择（速度快、与前端共识一致），XPath 在需要文本匹配或父子兄弟遍历时启用。定位器作为类属性集中管理，没有稳定锚点时推动前端加 `data-testid` 而不是在脆弱结构上玩定位技巧。

### 3. Driver 维度：管理资源

Driver 维度由 pytest fixture 统一收口生命周期：yield 之前创建，yield 之后必 quit；显式等待优先于隐式等待并封装在页面对象内部；function 作用域隔离每个用例避免状态污染；quit 而非 close 彻底清理避免 CI 资源泄漏。

::: tip 本节核心结论

Python 自动化测试的所有工程化要点都可以归入"POM · 定位 · Driver"三个维度。这个统一模型是工程化的思维框架：POM 解决"界面变动如何隔离"，定位解决"元素如何稳定锁定"，Driver 解决"资源如何生命周期管理"。三者通过"driver 注入页面对象、定位器作为类属性、fixture 管控生命周期"协作，共同把一次性脚本变成可持续维护的测试资产。

:::

---

## 九、Python 自动化测试实践清单

### 1. 架构设计阶段

- [ ] 为每个页面或独立区块创建独立的 Page Object 类
- [ ] 元素定位器作为类属性集中管理，不散落在方法内
- [ ] 操作方法返回自身以支持链式调用，跳转方法返回下一个页面对象
- [ ] 公共区块抽成 Component 类通过组合引入，不用继承
- [ ] 页面对象只提供服务不包含断言，断言留在测试用例层

### 2. 定位器设计阶段

- [ ] 优先使用 id / name 定位，没有则推动前端加 data-testid
- [ ] 默认使用 CSS Selector，需要文本匹配或父子兄弟遍历时启用 XPath
- [ ] 避免使用绝对 XPath（/html/body/...），用相对 XPath 配合稳定锚点
- [ ] 区分语义 class（如 .login-form）与样式 class（如 .btn-primary），只依赖前者
- [ ] 不依赖绝对位置（nth-child、层级路径）定位元素

### 3. Driver 生命周期阶段

- [ ] driver 由 pytest fixture 统一管理，不在用例或页面对象里直接 webdriver.Chrome()
- [ ] fixture 用 yield 模式，yield 之后必调用 driver.quit()
- [ ] 默认使用 function 作用域保证用例隔离，class/session 作用域慎用
- [ ] 使用 driver.quit() 而非 driver.close() 彻底清理浏览器进程和驱动服务
- [ ] CI 环境配置 --headless / --no-sandbox / --disable-dev-shm-usage 参数

### 4. 等待策略阶段

- [ ] 优先使用显式等待（WebDriverWait + expected_conditions）
- [ ] 显式等待封装在页面对象内部，用例层不感知等待逻辑
- [ ] 避免 time.sleep() 硬等待，CI 上不可控
- [ ] 全局隐式等待与显式等待不要混用，避免等待时间叠加产生意外
- [ ] 等待条件匹配业务语义（element_to_be_clickable 而非 presence_of_element_located）

### 5. 测试用例阶段

- [ ] 用例只与页面对象交互，不直接调用 driver.find_element
- [ ] 用例代码读起来像业务流程描述，产品和手工测试同事能看懂
- [ ] 用例之间数据隔离，每个用例用独立测试账号
- [ ] 用例独立可重复执行，不依赖其他用例的执行顺序
- [ ] 失败时调用 save_screenshot 保留现场便于排查

### 6. 并行与分布式阶段

- [ ] 使用 pytest-xdist 并行执行，每个进程独立 driver
- [ ] 并行用例数据隔离，避免多进程操作同一份数据产生竞争
- [ ] 接入 Selenium Grid 或云测平台时只换 driver 实现，业务代码不变
- [ ] CI 上监控浏览器进程数，发现僵尸进程立即排查 quit 缺失
- [ ] 分布式执行时统一浏览器版本与驱动版本，避免环境差异

### 7. 工程化进阶阶段

- [ ] 用类型提示（-> "LoginPage"）让 IDE 智能补全链式调用
- [ ] 把常用页面对象封装成 fixture，减少用例样板代码
- [ ] 用 conftest.py 集中管理 driver、页面对象、测试数据等 fixture
- [ ] 定位器变更时只改 Page Object 一处，所有用例零变动
- [ ] 定期审查用例稳定性，P95 执行时间异常时排查 driver 复用问题

---

## 结语：从脚本到资产的三块基石

Python 自动化测试的工程化不是"用 Selenium 写几段 find_element 脚本能跑通就行"，而是一套从架构、定位到资源的完整工程方法。它的价值不在于"能跑通登录流程"，而在于把界面变动、元素锁定、资源生命周期这三件事拆清楚：界面变动如何被隔离在单个页面对象内部、元素如何被稳定锁定而不依赖脆弱结构、浏览器资源如何被 fixture 统一收口避免泄漏。

现代项目的迭代节奏不允许测试用例每改一次前端就大规模返工。只有把 POM 架构、定位策略、Driver 生命周期这三块基石搭好，自动化测试才能从"一次性脚本"变成"可持续维护的测试资产"——前端改 id 只改一处定位器、用例代码读起来像业务流程描述、CI 跑几百条用例不漏一个浏览器进程。这种工程化能力，是自动化测试体系在频繁迭代下不被废弃的唯一保障。

最终，本文的中心仍然是：

> **Python 自动化测试的工程化本质，是通过 POM 架构隔离界面变动、用精准定位策略锁定元素、以 Driver 生命周期管理资源，将一次性脚本变为可持续维护的测试资产。**

---

## FAQ

### 1. POM 一定要用 Python 类实现吗？用函数封装不行吗？

函数封装能解决"定位器散落"的问题，但无法表达"页面跳转链"。POM 的核心价值之一是方法返回下一个页面对象，形成 `LoginPage → HomePage → ProfilePage` 的链式调用，这需要类来承载状态（driver）和行为（操作 + 跳转）。函数封装做不到这一点，用例代码会退化为命令式堆叠。此外，组件复用（如 HeaderComponent 通过组合引入多个页面）也依赖类的组合能力。

### 2. XPath 真的比 CSS Selector 慢吗？慢多少？

在绝大多数现代浏览器上，CSS Selector 由浏览器原生 CSS 引擎处理，XPath 由单独的 XPath 引擎处理，前者确实更快。但"慢多少"取决于 XPath 复杂度——简单 XPath（如 `//button[@id='login']`）与 CSS Selector 差距很小，复杂 XPath（多层轴遍历、contains 文本匹配）差距可能达到数倍。对于功能测试这种几十毫秒级操作，性能差距通常不是瓶颈；只有在大量元素批量定位的场景下才需要严肃考虑。

### 3. driver.implicitly_wait 和 WebDriverWait 能一起用吗？

技术上可以，但工程上不推荐。隐式等待是全局的，会对所有 `find_element` 调用生效；显式等待是针对特定条件的。两者混用时，等待时间会叠加（隐式等待 + 显式等待），产生不可预期的总等待时间。推荐做法是只用显式等待，并把显式等待封装在页面对象内部，让用例层无感知。

### 4. pytest fixture 用 function 还是 session 作用域？

默认用 function 作用域，保证用例完全隔离。session 作用域下所有用例共享一个 driver，一旦某个用例让浏览器进入异常状态（如未退出登录、打开了错误页面），后续所有用例都会失败。class 作用域适合一组强相关用例共享登录态，但要注意用例之间不能互相污染状态。session 作用域只在用例数量极多、driver 启动开销成为瓶颈时才考虑，并且要配合 `@pytest.fixture(autouse=True)` 的状态重置逻辑。

### 5. 自动化用例增长到几百条后执行很慢，怎么优化？

先排查 driver 复用问题：如果每条用例都启动新 driver，几百条用例的启动开销会非常可观，可以考虑对一组强相关用例用 class 作用域共享 driver。再排查等待策略：如果有大量 `time.sleep` 或过长的显式等待超时，会拖慢整体执行。接着考虑并行执行：用 pytest-xdist 多进程并行，每个进程独立 driver。最后排查用例设计：用例之间是否真的需要串行？是否有重复的登录/导航步骤可以抽成 fixture 复用？不要在单进程串行执行上死磕，并行 + driver 复用才是规模化执行的正解。

---

## 来源

1. Selenium 官方文档 - Page Objects 模式：

   [https://www.selenium.dev/documentation/test_practices/encouraged/page_object_models/](https://www.selenium.dev/documentation/test_practices/encouraged/page_object_models/)

2. Selenium 官方文档 - Waits 等待策略：

   [https://www.selenium.dev/documentation/webdriver/waits/](https://www.selenium.dev/documentation/webdriver/waits/)

3. pytest 官方文档 - Fixtures：

   [https://docs.pytest.org/en/stable/explanation/fixtures.html](https://docs.pytest.org/en/stable/explanation/fixtures.html)

4. Martin Fowler - PageObject 模式原文：

   [https://martinfowler.com/bliki/PageObject.html](https://martinfowler.com/bliki/PageObject.html)

5. MDN Web Docs - CSS Selectors：

   [https://developer.mozilla.org/zh-CN/docs/Web/CSS/CSS_selectors](https://developer.mozilla.org/zh-CN/docs/Web/CSS/CSS_selectors)

6. MDN Web Docs - XPath 文档：

   [https://developer.mozilla.org/zh-CN/docs/Web/XPath](https://developer.mozilla.org/zh-CN/docs/Web/XPath)

7. pytest-xdist 分布式执行插件：

   [https://pytest-xdist.readthedocs.io/en/stable/](https://pytest-xdist.readthedocs.io/en/stable/)
